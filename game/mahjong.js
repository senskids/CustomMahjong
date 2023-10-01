const utils = require('./utils');
const Player = require('./player');

class Mahjong {
    constructor(socket) {
        // クライアントとのSocket
        this.socket = socket;
        // このゲームに参加しているプレイヤーの情報
        this.players = [];
        // 全ての牌の数
        this.all_tile_num = 136;
        // 非公開の牌のid (裏側の牌)
        this.secret_id = this.all_tile_num;        
        // ダブロン、トリロンありか
        this.can_multi_ron = true;
        // 起家のインデックス
        this.start_player_idx = 0;  // FIXME おそらく0で固定
        // 現在の場
        this.field_count = 0;   // 0:東, 1:南, 2:西, 3:北
        // 現在の局
        this.round_count = 0;   // 1局 
        // 現在の場
        this.honba_count = 0;   // 0本場
        // この局の親のインデックス
        this.parent_idx = 0;

        /* 1ゲーム内で値が変化する変数達 */
        // 現在のプレイヤーのインデックス
        this.cplayer_idx = 0;
        // 山牌
        this.tiles = [];
        // 王牌
        this.dead_tiles = [];
        // 現在のドラ
        this.dora = [];
        // すでに捨てられた牌
        this.discards = [];  // FIXME 今のところ使っていない
        // 現在、捨てるのが禁止されている牌（鳴いた後の喰い変え、立直など）
        this.forbidden_discards = [];    // FIXME : 各プレイヤーに入れるべき
        // ツモを捨てた時にドラをめくるかどうか
        this.is_open_next_dora = false;
        // ユーザからのアクション関係を扱う
        this.user_response = [];  
        this.declare_queue = [];  // {player: xx, action_type: XXX, priority: XXX}
        this.timeout_id = -1;


        // ゲームの状態を表す定数
        this.GAME_STATE = {
            WAITING_FOR_PLAYERS: 'waiting-for-players',
            DEALING: 'dealing',
            PLAYING: 'playing',
            ENDED: 'ended',
        };
        this.state = this.GAME_STATE.WAITING_FOR_PLAYERS;        
    }
    
    /* クライアントを管理するメソッド */
    // 人を追加する  FIXME : ゲームが開始している時は牌も表示するようにする
    addPlayer(user_name, socket_id, user_id) {
        let player_id = -1;
        // リロードの場合にもとのプレイヤーに戻る（forEachだとreturnがきかない）
        for (var p = 0; p < this.players.length; p++){
            if (this.players[p].getUserId() == user_id) {
                this.players[p].setSocketId(socket_id);
                this.players[p].setActive(true);
                console.log("[mahjong.js, addPlayer] %s is readded", user_name);
                player_id = p;
                break;
            }
        }
        // 定員がいっぱいじゃない場合、新しくプレイヤーを追加する
        if (this.players.length < 4) {
            this.players.push(new Player(this, this.socket, socket_id, user_id, user_name));
            console.log("[mahjong.js, addPlayer] %s is added", user_name);
            player_id = this.players.length - 1;
        }
        // 定員がいっぱいの場合、user_idが設定されていないcpuがいれば乗り移る
        for (var p = 0; p < this.players.length; p++){
            if (!this.players[p].getActive() && (this.players[p].getUserId() == null)){
                console.log("[mahjong.js, addPlayer] %s -> %s", this.players[p].getUserName(), user_name);
                this.players[p].setUserId(user_id);
                this.players[p].setUserName(user_name);
                this.players[p].setSocketId(socket_id);
                this.players[p].setActive(true);
                player_id = p;
                break;
            }
        }
        // 定員がいっぱいの場合
        if (player_id == -1){
            console.log("[mahjong.js, addPlayer]定員がいっぱいです");
            return;
        }
        // // 各プレイヤーに情報を送る  FIXME
        // for (var p = 0; p < this.players.length; p++){
        //     if (p == player_id){
        //         this.players[p].sendMsg();
        //     }
        //     else{
        //         this.players[p].sendMsg();
        //     }
        // }
    }

    // 人を削除する
    removePlayer(socket_id) {
        // socket_idのプレイヤーを探す
        let p = this.whoAction(socket_id);
        if (p < 0) return;
        console.log("[mahjong.js, removePlayer] %s is removed", this.players[p].getUserName());
        this.players[p].setActive(false);
    }

    /* 麻雀ゲーム進行に必要なメソッド群 */
    // ゲームを開始する
    startGame() {
        // 既にゲームがスタートしている時はreturnする
        // 現在はDebug用に強制的に次のゲームをスタートする  FIXME
        if (this.state == this.GAME_STATE.PLAYING) {
            // return;
        }
        console.log("Game Start");

        // プレイヤーが4人揃っていなければCPUを追加する
        for (var i = 0; this.players.length < 4; i++){
            var cpu = new Player(this, this.socket, null, null, "cpu" + String(i + 1));
            cpu.setActive(false);
            this.players.push(cpu);
        }

        // ツモ順をランダムに決定する
        console.log("自摸順をランダム化");
        utils.shuffleArray(this.players);
        this.players.forEach((p, pi) => {
            p.setSeat(pi);
            console.log("  Player%d : %s, %s", pi+1, p.getUserName(), p.getUserId());
        });

        // 東1局0本場からスタートする
        this.field_count = 0;   // 東
        this.round_count = 0;   // 1局
        this.honba_count = 0;   // 0本場
        this.state = this.GAME_STATE.PLAYING;
        console.log("半荘戦スタート");

        // ゲームスタートの状態を全ユーザに共有する  FIXME
        for(var i = 0; i < 4; i++){
            var rdx = (i + 1) % 4;  // 下家
            var odx = (i + 2) % 4;  // 対面
            var ldx = (i + 3) % 4;  // 上家
            this.players[i].sendMsg('game-status', {
                seat: i,  // 0:起家 
                names: [
                    this.players[i].getUserName(), 
                    this.players[rdx].getUserName(), 
                    this.players[odx].getUserName(), 
                    this.players[ldx].getUserName()
                ], 
            });
        }

        // 1局をスタートする
        this.startOneGame();
    }

    /* 1局が終わった後、次の局をスタートする */
    forwardGame(who_winned, special = false){
        // 特殊な流れ方をしたか（九種九牌など）  FIXME
        let is_special = special;
        // 親があがったか
        let is_parent_win = who_winned.includes(this.parent_idx);
        // 流局したか
        let is_ryukyoku = who_winned.length == 0;
        // 流局している場合、南場 OR 親聴牌であったか  FIXME

        // 親流れせず、本場を増やして再開
        if (is_special || is_parent_win || is_ryukyoku){
            this.honba += 1;
        }
        // 親が流れる
        else{
            this.round_count = this.round_count + 1;
            if (this.round_count == 4) {
                this.round_count = 0;
                this.field_count += 1;
            }
            this.honba_count = 0;
            this.parent_idx = this.round_count;
        }
        // 終了判定
        if (this.field_count == 2) {
            this.endGame();
            return;
        }
        // 次の局をスタートする
        this.startOneGame();
    }
    
    /* 終了処理 */
    endGame(){
        // 順位
        var ret = points.map((p, i) => [i + 1, p]);
        ret.sort((a, b) => b[1] - a[1]);
        console.log("result", ret);        
        // 結果を送る
        let msg = {}
    }


    /* 1局を進行するのに必要なメソッド群 */
    // 1局をスタートするメソッド
    startOneGame(){
        // 親を決定する
        this.parent_idx = this.round_count;
        console.log("東1局、親は%s", this.players[this.parent_idx].getUserName());
        
        // 山を作る
        this.tiles = [...Array(this.all_tile_num)].map((_, i) => i);
        // utils.shuffleArray(this.tiles);
        // 配牌
        for(var p = 0; p < this.players.length; p++){
            this.players[p].setInitialTiles(this.tiles.slice(0, 13));  // 頭13個をpush
            this.tiles = this.tiles.slice(13);   // 頭13個抜き取った山牌を新たな山牌にする
        }
        // 王牌
        this.dead_tiles = this.tiles.slice(0, 13);
        // ドラ表示
        this.dora = [this.tiles.pop()];

        // 全ユーザに状態を送る
        for(var i = 0; i < 4; i++){
            let ldx = (i + 3) % 4;  // 上家
            let odx = (i + 2) % 4;  // 対面
            let rdx = (i + 1) % 4;  // 下家
            this.players[i].sendMsg('data', {
                // 自分
                enable_actions: this.players[i].getEnableActions(), 
                myHandTiles: {code: 'full', value: this.players[i].getHands()}, 
                myDiscardTiles: {code: 'full', value: this.players[i].getDiscards()}, 
                myMeldTiles: {code: 'full', value: this.players[i].getMelds()}, 
                // 上家
                leftHandTiles: {code: 'full', value: Array(this.players[ldx].getHands().length).fill(this.secret_id)}, 
                leftDiscardTiles: {code: 'full', value: this.players[ldx].getDiscards()}, 
                leftMeldTiles: {code: 'full', value: this.players[ldx].getMelds()}, 
                // 対面
                oppositeHandTiles: {code: 'full', value: Array(this.players[odx].getHands().length).fill(this.secret_id)}, 
                oppositeDiscardTiles: {code: 'full', value: this.players[odx].getDiscards()}, 
                oppositeMeldTiles: {code: 'full', value: this.players[odx].getMelds()},
                // 下家
                rightHandTiles: {code: 'full', value: Array(this.players[rdx].getHands().length).fill(this.secret_id)}, 
                rightDiscardTiles: {code: 'full', value: this.players[rdx].getDiscards()}, 
                rightMeldTiles: {code: 'full', value: this.players[rdx].getMelds()},
                // ドラ
                doraTiles: {code: 'full', value: this.dora}, 
            });
        }

        // 親のツモからスタート
        this.cplayer_idx = this.parent_idx;
        this.drawTile()
    }

    // 山から1枚ツモする関数
    drawTile(){
        // 順番のプレイヤーのツモ
        let draw_tile = this.tiles.pop();
        this.players[this.cplayer_idx].drawTile(draw_tile);
        // ツモに対してどんなアクションが可能かをチェックする
        this.players[this.cplayer_idx].checkEnableActionsForDrawTile(draw_tile, false, this.getFieldInfo());


        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                player: (this.cplayer_idx - i + 4) % 4,  // player iから見てどこか 
                action: 'draw', 
                tile: (this.cplayer_idx == i)? draw_tile: this.secret_id, 
            });
        }        
    }

    // 1枚切る処理
    discardTile(socket_id, discard_tile){
        // このアクションは合法かどうかを判定する
        let p = this.whoAction(socket_id);  // アクションしたプレイヤーの番号
        let player = this.players[p];
        if (!(player.enable_actions.discard)){
            console.log("[ERROR A] illigal action");
            return;
        }

        // 捨てるのが禁止されている牌かを確認する
        if (this.forbidden_discards.includes(discard_tile)){
            player.sendMsg('cannot-discard-tile');
            return;
        }
        this.forbidden_discards = [];

        // player pから牌を切る
        discard_tile = player.discardTile(discard_tile);
        if (discard_tile == "Null"){
            console.log("[ERROR B] illigal action");
            return;
        }

        // 全ユーザの状態を変更する（ポン出来るかなどの判定）
        this.user_response = [false, false, false, false];  
        for(var i = 0; i < 4; i++){
            // プレイヤーpがdiscard_tileを切ったことに対し、何ができるか
            this.players[i].checkEnableActionsForDiscardTile(p, discard_tile, this.getFieldInfo());  
            // ラスつもなら槓できないなどの判定  FIXME
            if (!this.players[i].canAnyAction()) this.user_response[i] = true;
        }

        // 全ユーザに情報を送る
        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                action: 'discard',  
                player: (p - i + 4) % 4,  
                tile: discard_tile,
            });
        }        

        // 明槓などで新ドラをオープンする
        if(this.is_open_next_dora){
            // ドラの情報を送る
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                action: 'dora',  
                player: null, 
                tile: this.dora[this.dora.length - 1], 
            });
        }

        // 他家からのアクションリスト    
        this.declare_queue = [];
        // 次のツモに遷移するまで、各プレイヤーの持ち時間の最大時間待つ  // FIXME
        let waiting_time = (this.user_response[0] && this.user_response[1] && this.user_response[2] && this.user_response[3])? 100: 10000;
        this.timeout_id = setTimeout(this.moveNext.bind(this), waiting_time);
    }


    // 誰かが捨てた牌に対し、ポンやチー、ロンなどの宣言をした際に、それを一旦保存するメソッド
    declareAction(socket_id, action_type){
        // このアクションは合法かどうかを判定する
        let p = this.whoAction(socket_id);
        let player = this.players[p];
        if (!(player.enable_actions[action_type])){
            console.log(`[ERROR D] ${player.getUserName()} cannot do ${action_type}`);
            return;
        }

        // スキップが送られてきた場合は特殊処理
        if (action_type == 'skip') {
            this.user_response[p] = true;
            // 全員がスキップボタンを押したらツモに戻る
            if (this.user_response[0] && this.user_response[1] && this.user_response[2] && this.user_response[3]) {
                clearTimeout(this.timeout_id);
                this.timeout_id = setTimeout(this.moveNext.bind(this), 100);
            }
            return;
        }

        // ツモしたプレイヤーのアクションの場合
        if (p == this.cplayer_idx){
            if (action_type == 'kan') {
                var ret = [];
                var ankans = utils.canAnkan(player.getHands());
                ankans.forEach(e => {ret.push(e)});
                var kakans = utils.canKakan(player.getHands(), player.getMelds());
                kakans.forEach(e => {ret.push(e)});
                player.sendMsg('select-kan-cand', ret);
            }
            else if (action_type == 'riichi') {
                ret = utils.canRiichi(player.getHands(), player.getMelds());
                player.sendMsg('select-riichi-cand', ret);
            }
            return;
        }

        // flag管理もう少しちゃんとしたほうがいいかも  ISSUE
        let priority = {'pon': 1, 'kan': 1, 'chi':0, 'ron': 999}[action_type];
        if (priority == 2) [-1, 999, 998, 997][(p - this.cplayer_idx + 4) % 4];  // 頭ハネの優先度を反映。cplayer_idxの上家が最優先
        let action_content = {player: p, action_type: action_type, priority: priority};
        this.declare_queue.push(action_content);
        
        // この人がmeldしたことを全員にpushする処理を入れる  FIXME
        for (var i = 0; i < 4; i++)
            this.players[i].sendMsg('action', action_content);
        
        // このプレイヤーの宣言が1番目の場合は、現在設定されているsetTimeoutを解除し、1秒後にselectDeclaredAction関数を実行する
        if (this.declare_queue.length == 1){
            clearTimeout(this.timeout_id);
            this.timeout_id = setTimeout(this.selectDeclaredAction.bind(this), 1000);
        }
    }


    // 誰かが捨てた牌に対し、ポンやチー、ロンなどの宣言をした際に、実際にどのアクションを採用するかを選ぶ
    selectDeclaredAction(){  
        // declare_queueからどのアクションを採用するかを選ぶ（ロン、(カン、ポン)、チーの順番で優先する）
        let selected = [this.declare_queue[0]];
        let is_exist_ron = selected[0].priority > 100;
        for (var i = 0; i < this.declare_queue.length; i++){
            var ele = this.declare_queue[i];
            if (ele.priority > 100 && selected[0].priority > 100 && this.can_multi_ron){
                is_exist_ron = true;
                selected.push(ele);
            }
            else if (ele.priority > selected.priority){
                selected[0] = ele;
                if (ele.priority > 100) is_exist_ron = true;
            }
        }

    
        let p2 = this.cplayer_idx;  // 捨てた人
        let discard = this.players[this.cplayer_idx].getDiscards().pop();   // 捨てられた牌

        // ロン、ダブロン、トリロンの場合
        if (is_exist_ron){
            this.performRon(selected, p2, discard);
            return;
        }
        // ポン、カン、チーのいずれか
        let p1 = selected[0].player;  // 拾う人
        let meld_type = selected[0].action_type;  // ポン、チー、カンの種類
        this.meld_info = {p1: p1, p2: p2, discard: discard, meld_type: meld_type};
        var ret;  // 手牌から切るツモ達の候補
        if (meld_type == 'chi') ret = utils.canChi(this.players[p1].getHands(), discard);
        else if (meld_type == 'pon') ret = utils.canPon(this.players[p1].getHands(), discard);
        else if (meld_type == 'kan') ret = utils.canKan(this.players[p1].getHands(), discard);
        // クライアントに選択させる
        this.players[p1].sendMsg('select-meld-cand', ret);
    }


    // 誰かが捨てた牌に対し、ポンやチーなどの宣言をした際に、実際にそのアクションを実行する
    performMeld(socket_id, hands){
        let p = this.whoAction(socket_id);
        if (this.meld_info.p1 != p){
            console.log("[ERROR F] illigal action");
            return;
        }
        
        // pが鳴きを実行する
        this.players[p].performMeld(this.meld_info.meld_type, this.meld_info.p2, hands, this.meld_info.discard);

        // 拾う人から見て、鳴かれた人は誰か：1:下家, 2:対面, 3:上家
        this.meld_info["tgt_p"] = (this.meld_info.p2 - p + 4) % 4;
        this.meld_info["hands"] = [...hands];

        // 喰い変えを禁止する
        this.forbidden_discards = [];  // FIXME

        // カンの場合
        if (hands.length == 3) {  
            // 四槓子、流局チェック　// FIXME
            // 王牌から1枚ドローする
            let replacement_tile = this.dead_tiles.pop();
            // 山牌から王牌に1枚追加する
            this.dead_tiles.push(this.tiles.pop());
            // ドラ追加
            this.dora.push(this.dead_tiles.pop());
            // 明槓なので捨てた後にドラを表示する
            this.is_open_next_dora = true;
            // 明槓なので捨てた後にドラを表示する
            this.is_open_next_dora = true;
            // カンした人に嶺上牌をひかせる
            this.players[p].drawTile(replacement_tile, true);
            // 全プレイヤーに情報を送る
            for(var i = 0; i < 4; i++){
                this.players[i].enable_actions = {discard: i == p, pon: false, chi: false, ron: false, riichi: false, kan: false};
                this.players[i].sendMsg('diff-data', {
                    enable_actions: this.players[i].getEnableActions(), 
                    player: (p - i + 4) % 4,  // player iから見てどこか 
                    action: 'kan', 
                    tile: this.meld_info, 
                });
            }      
        }

        // ポンかチーの場合
        else{
            // 全プレイヤーに情報を送る
            for(var i = 0; i < 4; i++){
                this.players[i].enable_actions = {discard: i == p, pon: false, chi: false, ron: false, riichi: false, kan: false};
                this.players[i].sendMsg('diff-data', {
                    enable_actions: this.players[i].getEnableActions(), 
                    player: (p - i + 4) % 4,  // player iから見てどこか 
                    action: 'meld', 
                    tile: this.meld_info, 
                });
            }      
        }

        // 手牌から一枚切らせる
        this.cplayer_idx = p;  // 手番を変更する
        // CPUだったら適当に牌を捨てる
        if (!this.players[this.cplayer_idx].is_active){
            setTimeout(this.discardTile.bind(this), 1000, this.cplayer_idx, 0);
        }               
    }

    moveNext(){
        this.cplayer_idx = (this.cplayer_idx + 1) % this.players.length;
        this.drawTile();        
    }


    performRon(ron_players, roned_player, roned_tile){
        console.log("Ron!!!");
        for (var i = 0; i < ron_players.length; i++){
            let ron_player = ron_players.player;
        }
    }



    performAnkan(socket_id, hands){
        let p = this.whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.kan)){
            console.log("[ERROR A] illigal action");
            return;
        }
        var ret = utils.canAnkan(player.getHands());
        if (!ret.some(sub => sub.length === hands.length && sub.every((e, i) => e === hands[i]))){
            console.log("[ERROR B] illigal action");
            return;
        }

        player.performAnkan(hands);
        // 四槓子、流局チェック　// FIXME
        // 王牌から1枚ドローする
        let replacement_tile = this.dead_tiles.pop();
        // 山牌から王牌に1枚追加する
        this.dead_tiles.push(this.tiles.pop());
        // ドラ追加
        this.dora.push(this.dead_tiles.pop());
        // カンした人に嶺上牌をひかせる
        this.players[p].drawTile(replacement_tile, true);
        this.players[p].checkEnableActionsForDrawTile(replacement_tile, false, this.getFieldInfo());
        // 槍槓判定を入れる
        // 全プレイヤーに情報を送る
        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                player: (p - i + 4) % 4,  // player iから見てどこか 
                action: 'kan',  // FIXME 
                melds: {"tgt_p":null, "hands":[...hands]}, 
                tile:  (this.cplayer_idx == i)? replacement_tile: this.secret_id, 
            });
        }      

        // ドラの情報を送る
        for (var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                action: 'dora',  
                player: null, 
                tile: this.dora[this.dora.length - 1], 
            });
        }
    }

    performKakan(socket_id, hand){
        let p = this.whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.kan)){
            console.log("[ERROR A] illigal action");
            return;
        }
        var ret = utils.canKakan(player.getHands(), player.getMelds());
        if (ret.includes(hand)){
            console.log("[ERROR B] illigal action");
            return;
        }
        player.performKakan(hand);
    }








    performRiichi(socket_id, discard_tile){
        console.log("[performRiichi]");
        let p = this.whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.riichi)){
            console.log("[ERROR A] illigal action");
            return;
        }
        var ret = utils.canRiichi(player.getHands(), player.getMelds());
        if (discard_tile === null) discard_tile = ret[0];
        if (!ret.includes(discard_tile)){
            console.log("[ERROR G] illigal action");
            return;
        }
        // 立直処理  FIXME
        player.performRiichi(discard_tile);
        
        // this.double_riichi_chance

        this.discardTile(socket_id, discard_tile);
    }
    performTsumo(socket_id){
        let p = this.whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.tsumo)){
            console.log("[ERROR A] illigal action");
            return;
        }
        // performRon
    }

    getFieldInfo = function(){
        return {
            rule:           null, 
            zhuangfeng:     this.field_count,      // 場風
            menfeng:        this.round_count,      // 自風
            baopai:         this.dora,             // ドラ表示牌の配列
            fubaopai:       null,                  // 裏ドラ表示牌の配列
            hupai: {
                lizhi:      null,                  // 立直なし0, 立直1, ダブリー2
                yifa:       false,                 // 一発
                qianggang:  false,                 // 槍槓
                lingshang:  false,                 // 嶺上
                haidi:      0,                     // 0: ハイテイなし、1: ハイテイツモ、2: ハイテイロン  FIXME
                tianhu:     0                      // 0: 天和/地和なし、1: 天和、2: 地和   FIXME
            },
            jicun: {
                changbang:  this.honba_count,      // 積み棒の本数
                lizhibang:  0                      // 立直棒の本数   // FIXME
            }
        }
    }



        // ゲームの状態を取得する
        getState() {
            return {
                // dealer: this.dealer,
                // currentPlayer: this.currentPlayer,
                // dora: this.dora,
                // hands: this.hands,
                // discards: this.discards,
                // melds: this.melds,
                // points: this.points,
                // yakuList: this.yakuList,
                // isRiichi: this.isRiichi,
                // isTenpai: this.isTenpai,
            };
        }
    






    findPlayerId(socket_id){
        for(var i = 0; i < this.players.length; i++){
            if (socket_id == this.players[i].getSocketId(i))
                return i;
        }
        return -1;
    }

    // socket_idが誰かを判定する
    whoAction(socket_id){
        if(!isNaN(socket_id) && socket_id < 4)  // CPUの場合
            return socket_id;
        else   // クライアントの場合
            return this.findPlayerId(socket_id);
    }


    // 情報を作成する
    getFullStatus(player_id){

    }

}

module.exports = Mahjong;
