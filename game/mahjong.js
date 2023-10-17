const utils = require('./utils');
const Player = require('./player');
const debug = require('../debug');

class Mahjong {

    constructor(socket) {
        /** クライアントとのSocket */
        this.socket = socket;
        /** このゲームに参加しているプレイヤーの情報 */
        this.players = [];
        /** 全ての牌の数 */
        this.all_tile_num = 136;
        /** 非公開の牌のid (裏側の牌) */
        this.secret_id = this.all_tile_num;        
        /** ダブロン、トリロンありか */
        this.can_multi_ron = true;
        /** 起家のインデックス */
        this.start_player_idx = 0;  // FIXME おそらく0で固定
        /** 現在の場 */
        this.field_count = 0;   // 0:東, 1:南, 2:西, 3:北
        /** 現在の局 */
        this.round_count = 0;   // 1局 
        /** 現在の場 */
        this.honba_count = 0;   // 0本場
        /** この局の親のインデックス */
        this.parent_idx = 0;

        ///// 1ゲーム内で値が変化する変数達 /////
        /** 現在のプレイヤーのインデックス */
        this.cplayer_idx = 0;
        /** 山牌 */
        this.tiles = [];
        /** 王牌 */
        this.dead_tiles = [];
        /** 現在のドラ */
        this.dora = [];
        /** すでに捨てられた牌 */
        this.discards = [];  // FIXME 今のところ使っていない
        /** カンリスト {'player': Number, 'from_who': Number} */
        this.kans = [];  
        /** ゲームの状態を表す定数 */
        this.GAME_STATE = {
            WAITING_FOR_PLAYERS: 'waiting-for-players',
            DEALING: 'dealing',
            PLAYING: 'playing',
            ENDED: 'ended',
        };
        /** 現在のゲームの状態 */
        this.state = this.GAME_STATE.WAITING_FOR_PLAYERS;        
        
        ///// ユーザからのアクション関係を扱う /////
        /** ツモを捨てた時にドラをめくるかどうか */
        this.is_open_next_dora = false;
        /** 捨牌などに対し、次に進めてよいと反応したか否か */
        this.player_skip_responses = [false, false, false, false];
        /** ポンやロンなどの宣言をしていいかどうか */
        this.can_declare_action = false;
        /** 捨牌に対する他家の宣言を格納するqueue   
         *  中身：{player: xx, action_type: XXX, priority: XXX} */
        this.declare_queue = [];
        /** FIXME */
        this.timeout_id = -1;
        /** */
        this.next_process_info = {"func": null, "opt": null};
    }
    

    ///// クライアントを管理するメソッド /////

    /** FIXME #14 : ゲームが開始している時は牌も表示するようにする
     * プレイヤーログイン時にプレイヤーを追加する
     * @param {String} user_name  ユーザ名
     * @param {String} socket_id  現在のソケット通信のID
     * @param {String} user_id    ユーザ固有の値（ソケット通信が変わっても影響を受けない）
     * @returns {Boolean}         プレイヤーがゲームに入れたか否か
     */
    addPlayer(user_name, socket_id, user_id) {
        let player_id = -1;
        // リロードの場合にもとのプレイヤーに戻る
        for (var p = 0; p < this.players.length; p++){
            if (this.players[p].getUserId() == user_id) {
                this.players[p].setSocketId(socket_id);
                this.players[p].setActive(true);
                console.log("[mahjong.js, addPlayer] %s is readded", user_name);
                player_id = p;
                return true;
            }
        }
        // 定員がいっぱいじゃない場合、新しくプレイヤーを追加する
        if (this.players.length < 4) {
            this.players.push(new Player(this, this.socket, socket_id, user_id, user_name));
            console.log("[mahjong.js, addPlayer] %s is added", user_name);
            player_id = this.players.length - 1;
            return true;
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
                return true;
            }
        }
        // 定員がいっぱいの場合
        if (player_id == -1){
            console.log("[mahjong.js, addPlayer]定員がいっぱいです");
            return false;
        }
    }


    /** 
     * socket_idのプレイヤーをゲームから取り除く
     * @param {String} socket_id  取り除きたいプレイヤーのSocketID
     * @returns {Boolean}         プレイヤーを取り除けたか否か
     */
    removePlayer(socket_id) {
        // socket_idのプレイヤーを探す
        let p = this.#whoAction(socket_id);
        if (p < 0) return false;
        console.log("[mahjong.js, removePlayer] %s is removed", this.players[p].getUserName());
        this.players[p].setActive(false);
        return true;
    }


    ///// 麻雀ゲーム進行に必要なメソッド群 /////

    /** 
     * 半荘を開始する  
     * @next startOneGame
     */
    startGame() {
        // 既にゲームがスタートしている時はreturnする
        if (this.state == this.GAME_STATE.PLAYING) {
            // 現在はDebug用に強制的に次のゲームをスタートする  FIXME
            // return;
        }

        // プレイヤーが4人揃っていなければCPUを追加する
        for (var i = 0; this.players.length < 4; i++){
            var cpu = new Player(this, this.socket, null, null, "cpu" + String(i + 1));
            cpu.setActive(false);
            this.players.push(cpu);
        }

        // ツモ順をランダムに決定する
        utils.shuffleArray(this.players);
        this.players.forEach((p, pi) => {
            p.setSeat(pi);
        });

        // 東1局0本場からスタートする
        this.field_count = 0;   // 東
        this.round_count = 0;   // 1局
        this.honba_count = 0;   // 0本場
        this.state = this.GAME_STATE.PLAYING;

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
        setTimeout(this.startOneGame.bind(this), 10);
    }


    /**
     * 1局が終わった後、次の局をスタートする  
     * @param {Array} who_winned  前局に誰が上がったか
     * @param {JSON} special      前局に特殊な流れ方をしたか 
     * @next startOneGame or endGame
     */
    forwardGame(who_winned, special = false){
        // 特殊な流れ方をしたか（九種九牌など）  FIXME #15
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
            setTimeout(this.endGame.bind(this), 10);
            return;
        }
        // 次の局をスタートする
        setTimeout(this.startOneGame.bind(this), 10);
    }
    

    /**
     * 半荘戦を終了する  
     * @next null  FIXME
     */
    endGame(){
        // 順位
        const points = Array.from({ length: 4 }, (_, i) => this.players[i].getPoint());
        var ret = points.map((p, i) => [i + 1, p]);
        ret.sort((a, b) => b[1] - a[1]);
        console.log("result", ret);        
        // 結果を送る
        let msg = {}
    }


    ///// 1局を進行するのに必要なメソッド群 /////

    /** 
     * 1局をスタートする
     * @next drawTile
     */ 
    startOneGame(){
        // 親を決定する
        this.parent_idx = this.round_count;
        console.log("東1局、親は%s", this.players[this.parent_idx].getUserName());
        
        // 山を作る
        this.tiles = [...Array(this.all_tile_num)].map((_, i) => i);
        utils.shuffleArray(this.tiles);
        // this.tiles = debug.createTenhoTiles();
        console.log(this.tiles);
        // 配牌
        for(var p = 0; p < this.players.length; p++){
            this.players[p].setInitialTiles(this.tiles.slice(0, 13));  // 頭13個をpush
            this.tiles = this.tiles.slice(13);   // 頭13個抜き取った山牌を新たな山牌にする
        }
        // 王牌
        this.dead_tiles = this.tiles.slice(0, 13);
        this.tiles = this.tiles.slice(13);
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
        setTimeout(this.drawTile.bind(this), 10);
    }


    /** 
     * 山から1枚ツモする関数
     * @next null (クライアントからのmsg待ち)
     */ 
    drawTile(){

        // 順番プレイヤーのツモ
        let draw_tile = this.tiles.pop();
        this.players[this.cplayer_idx].drawTile(draw_tile);

        // cplayer_idxプレイヤーのツモに対して、各自どんなアクションが可能かをチェックする
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForDrawTile(this.cplayer_idx, draw_tile, this.getFieldInfo());

        // 全クライアントに通知
        this.sendDrawMsgToAll(this.cplayer_idx, draw_tile);
    }


    /**
     * socket_idのプレイヤーがdiscard_tileを捨てる
     * @param {String} socket_id     捨てるプレイヤーのsocket_id
     * @param {Number} discard_tile  捨牌のタイルID表現 
     * @next moveNext or selectDeclaredAction
     */
    discardTile(socket_id, discard_tile){
        // socket_idのプレイヤーがdiscard_tileを捨てる
        const p = this.#whoAction(socket_id);
        if (!this.players[p].getEnableActions().discard) {
            console.log("[ERROR, discardTile, A] 現在捨てるアクションが禁止されている");
            return;
        }

        let actRes = this.players[p].discardTile(discard_tile);
        // 何かしら問題があって牌を捨てる行為に失敗した場合はreturn
        if (!actRes) return;

        // player pがdiscard_tileを捨てたことに対し、全ユーザのEnableActionsを更新
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForDiscardTile(p, discard_tile, this.getFieldInfo()); 
        
        // 他プレイヤーからの宣言受け入れの準備
        this.declare_queue = [];           // プレイヤーからの宣言を貯めておくqueue
        this.can_declare_action = true;    // プレイヤーからの宣言を受け入れる状態にする
        const waiting_time = this.#getWaitTime() + 100;   // 何秒ほど待つべきか
        this.player_skip_responses = [...Array(4)].map((_,i) => !this.players[i].canAnyAction());  // 誰がアクションする可能性があるのか

        // 全ユーザに情報を送る
        this.sendDiscardMsgToAll(p, discard_tile);

        // 明槓などで新ドラをオープンする
        if(this.is_open_next_dora){
            this.is_open_next_dora = false;
            this.sendDoraOpenMsgToAll();
        }

        if (this.player_skip_responses.every(Boolean)){  // 誰も何もアクション出来ないので、すぐに次のツモにうつる
            this.timeout_id = setTimeout(this.moveNext.bind(this), waiting_time);
        }
        else {   // 誰かが宣言する権利を持っているので、宣言可能時間を確保する
            this.next_process_info = {"func": this.moveNext, "opt": null};
            this.timeout_id = setTimeout(this.selectDeclaredAction.bind(this), waiting_time);
        }
    }


    /** FIXME プレイヤーが立直宣言していたら点棒を渡す処理を追加する
     * ターンプレイヤーを次のプレイヤーに切り替える  
     * 流局判定もここで行う
     * @next drawTile or drawnGame
     */
    moveNext(){
        if (this.tiles.length > 0) {
            this.cplayer_idx = (this.cplayer_idx + 1) % this.players.length;
            setTimeout(this.drawTile.bind(this), 10);
        }
        else {  
            setTimeout(this.drawnGame.bind(this), 10);  // 流局
        }
    }


    /**
     * ターンプレイヤーが何かしら宣言した際の処理（そのまま宣言を実行する）
     * ツモ、立直、暗槓、加槓、九種九牌、(嶺上ツモ)、(ダブリー)
     * @param {String} socket_id     宣言をしたプレイヤーのsocket_id
     * @param {String} action_type   宣言の内容
     * @next クライアントからのmsg待ち or performAnkan or performKakan or performRiichi or performTsumo
     */
    turnPlayerDeclareAction(socket_id, action_type){
        const p = this.#whoAction(socket_id);
        const player = this.players[p];

        // socket_idプレイヤーはaction_typeを宣言できるか判定する
        if (!(player.enable_actions[action_type]) || p != this.cplayer_idx){
            console.log(`[ERROR, turnPlayerDeclareAction A] ${player.getUserName()} cannot do ${action_type}`);
            return;
        }

        // プレイヤーpがaction_typeを宣言したことを全員に通知する    
        this.sendDeclareMsgToAll(p, action_type);

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
        else if (action_type == 'tsumo'){
            if (utils.canTsumo(player.getHands(), player.getMelds(), player.getHands()[player.getHands().length - 1], this.getFieldInfo()))
                this.performTsumo(socket_id); 
        }
        return;
    }


    /** 
     * ターンプレイヤーじゃない人が、捨牌に対しポンやチー、ロンなどを宣言した際に、それをdeclare_queueに入れる処理  
     * ポン、チー、カン、ロン、(槍槓ロン)
     * @param {String} socket_id     宣言をしたプレイヤーのsocket_id
     * @param {String} action_type   宣言の内容
     * @next moveNext or selectDeclaredAction
     */
    notTurnPlayerDeclareAction(socket_id, action_type){
        // 誰が宣言したか
        const p = this.#whoAction(socket_id);
        const player = this.players[p];

        // ツモしたプレイヤーのアクションの場合  FIXME : ツモと捨牌のアクションで入口の関数を分けたい
        if (p == this.cplayer_idx){
            this.turnPlayerDeclareAction(socket_id, action_type);
            return;
        }

        // socket_idプレイヤーはaction_typeを宣言できるか判定する
        if (!(player.enable_actions[action_type])){
            console.log(`[ERROR, notTurnPlayerDeclareAction A] ${player.getUserName()} cannot do ${action_type}`);
            return;
        }
        if (!this.can_declare_action){
            console.log(`[ERROR, notTurnPlayerDeclareAction B] 宣言可能時間をオーバーしています`);
            return;
        }

        // スキップが送られてきた場合は特殊処理  
        if (action_type == 'skip') {
            this.player_skip_responses[p] = true;
            // 全員がスキップボタンを押したら、元の処理に戻る
            if (this.player_skip_responses.every(Boolean)){
                this.can_declare_action = false;
                clearTimeout(this.timeout_id);
                if (this.next_process_info.func === this.moveNext)
                    this.timeout_id = setTimeout(this.moveNext.bind(this), 10);
                else 
                    this.timeout_id = setTimeout(this.drawReplacementTile.bind(this), 10, this.next_process_info["opt"]);
            }
            return;
        }

        // 他家の宣言をdeclare_queueに入れる  
        let priority = {'pon': 1, 'kan': 1, 'chi':0, 'ron': 999}[action_type];
        if (priority == 2) [-1, 999, 998, 997][(p - this.cplayer_idx + 4) % 4];  // 頭ハネの優先度を反映。cplayer_idxの上家が最優先
        let action_content = {player: p, action_type: action_type, priority: priority};
        this.declare_queue.push(action_content);
        
        // この人が宣言したことを全員にpushする
        this.sendDeclareMsgToAll(p, action_type);
        
        // このプレイヤーの宣言が1番目の場合は、現在設定されているsetTimeoutを解除し、1秒後にselectDeclaredAction関数を実行する
        if (this.declare_queue.length == 1){
            clearTimeout(this.timeout_id);
            this.timeout_id = setTimeout(this.selectDeclaredAction.bind(this), 1000);
        }
    }


    /**
     * ターンじゃないプレイヤーの宣言があった際に、どの宣言を実行するか選ぶ
     * @next クライアントからのmsg待ち or performRon or performPon or performChi or performKan
     */
    selectDeclaredAction(){  
        // declare_queueにこれ以上pushしないようにflag管理する
        this.can_declare_action = false;

        // declare_queueに何も入っていないなら、次にすべきアクションを実行する
        if (this.declare_queue.length == 0){
            if (this.next_process_info.func === this.moveNext)
                this.timeout_id = setTimeout(this.moveNext.bind(this), 10);
            else 
                this.timeout_id = setTimeout(this.drawReplacementTile.bind(this), 10, this.next_process_info["opt"]);
            return;
        }

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

        // FIXME : 槍槓ロンに対応するために無理やり実装している...
        if (this.next_process_info.func === this.drawReplacementTile){
            let p2 = this.cplayer_idx;  // 槍槓された人
            var tmp = this.players[this.cplayer_idx].getMelds();
            let discard = tmp[tmp.length - 1].hands[0];   // FIXME
            setTimeout(this.performRon.bind(this), 10, selected, p2, discard);
            return;
        }

        let p2 = this.cplayer_idx;  // 捨てた人
        var tmp = this.players[this.cplayer_idx].getDiscards();
        let discard = tmp[tmp.length - 1];   // 捨てられた牌

        // ロン、ダブロン、トリロンの場合
        if (is_exist_ron){
            this.performRon(selected, p2, discard);
            return;
        }

        // ポン、カン、チーのいずれか
        let p1 = selected[0].player;  // 拾う人
        let meld_type = selected[0].action_type;  // ポン、チー、カンの種類
        this.next_process_info = {"func": null, "opt": {"p1":p1, "p2":p2, "discard": discard}}

        let ret;  // 手牌から切るツモ達の候補
        if (meld_type == 'chi') {
            this.next_process_info["func"] = this.performChi;
            ret = utils.canChi(this.players[p1].getHands(), discard);
            if (ret.length > 1) this.players[p1].sendMsg('select-meld-cand', ret);
            else setTimeout(this.performChi.bind(this), 10, p1, p1, p2, discard, ret[0]);
        }
        else if (meld_type == 'pon') {
            this.next_process_info["func"] = this.performPon;
            ret = utils.canPon(this.players[p1].getHands(), discard);
            if (ret.length > 1) this.players[p1].sendMsg('select-meld-cand', ret);
            else setTimeout(this.performPon.bind(this), 10, p1, p1, p2, discard, ret[0]);
        }
        else if (meld_type == 'kan') {  // カンは必ず1通りしかできない
            this.next_process_info["func"] = this.performKan;
            ret = utils.canKan(this.players[p1].getHands(), discard);
            setTimeout(this.performKan.bind(this), 10, p1, p1, p2, discard, ret[0]);
        }
    }


    /** 
     * 実際にアクションを実行する
     * @param {*} socket_id 
     * @param {*} hands 
     * @next performPon or performChi or performKan
     */
    performMeld(socket_id, hands){
        // Pon, Chi, Kanに分離
        let p1 = this.next_process_info.opt.p1;            // 鳴く人
        let p2 = this.next_process_info.opt.p2;            // 鳴かれる人
        let discard = this.next_process_info.opt.discard;  // 鳴かれる牌
        let func = this.next_process_info.func;            // 次に実行すべき関数（pon, chi, kan）
        (func.bind(this))(socket_id, p1, p2, discard, hands);
    }
    
    
    /**
     * ポンを実行する
     * @param {String} socket_id   これを実行した人のID
     * @param {Number} p1          鳴く人のID
     * @param {Number} p2          鳴かれる人のID
     * @param {Number} discard     鳴かれる牌のID
     * @param {Array} hands        手出しする牌
     * @next クライアントからのmsg待ち（discardTile）
     */
    performPon(socket_id, p1, p2, discard, hands) {
        // 正しい人が正しい鳴きをしようとしているかチェックする
        if (!this.#checkLegalActionForDiscardMeld(socket_id, p1, p2, discard, 'pon')) return;

        // 河から牌を抜く
        discard = this.players[p2].getDiscards().pop();  

        // 手牌からhandsを抜いてmeldを更新する
        // meld_info = {'type': 'pon', 'from_who': 相対SeatID, 'discard': タイルID, hands: Array（タイルID）}
        let meld_info = this.players[p1].performPon(p2, hands, discard);  

        // 手番を変更する
        this.cplayer_idx = p1;  

        // プレイヤーが鳴いたことによって、各自が何をできるか更新する
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForMeld(p1, p2, discard, [...hands]); 

        // 全プレイヤーに情報を送る
        this.sendMeldMsgToAll(p1, 'pon', meld_info);
    }


    /**
     * チーを実行する
     * @param {String} socket_id   これを実行した人のID
     * @param {Number} p1          鳴く人のID
     * @param {Number} p2          鳴かれる人のID
     * @param {Number} discard     鳴かれる牌のID
     * @param {Array} hands        手出しする牌
     * @next クライアントからのmsg待ち（discardTile）
     */
    performChi(socket_id, p1, p2, discard, hands) {
        // 正しい人が正しい鳴きをしようとしているかチェックする
        if (!this.#checkLegalActionForDiscardMeld(socket_id, p1, p2, discard, 'chi')) return;

        // 河から牌を抜く
        discard = this.players[p2].getDiscards().pop();  

        // 手牌からhandsを抜いてmeldを更新する
        // meld_info = {'type': 'chi', 'from_who': 3, 'discard': タイルID, hands: Array（タイルID）}
        let meld_info = this.players[p1].performChi(p2, hands, discard);  

        // 手番を変更する
        this.cplayer_idx = p1;  

        // プレイヤーが鳴いたことによって、各自が何をできるか更新する
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForMeld(p1, p2, discard, [...hands]); 

        // 全プレイヤーに情報を送る
        this.sendMeldMsgToAll(p1, 'chi', meld_info);
    }


    /**
     * カンを実行する（捨牌に対し他の人が槓する）
     * @param {String} socket_id   これを実行した人のID
     * @param {Number} p1          鳴く人のID
     * @param {Number} p2          鳴かれる人のID
     * @param {Number} discard     鳴かれる牌のID
     * @param {Array} hands        手出しする牌
     * @next クライアントからのmsg待ち（discardTile）
     */
    performKan(socket_id, p1, p2, discard, hands) {
        // 正しい人が正しい鳴きをしようとしているかチェックする
        if (!this.#checkLegalActionForDiscardMeld(socket_id, p1, p2, discard, 'chi')) return;

        // 河から牌を抜く
        discard = this.players[p2].getDiscards().pop();  

        // 手牌からhandsを抜いてmeldを更新する
        // meld_info = {'type': 'kan', 'from_who': 相対SeatID, 'discard': タイルID, hands: Array（タイルID）}
        let meld_info = this.players[p1].performKan(p2, hands, discard);

        // kans（フィールド全体のカン管理リスト）を更新する
        this.kans.push({'player': p, 'from_who': p2});  

        // 手番を変更する
        this.cplayer_idx = p1;  

        // プレイヤーが鳴いたことによって、各自が何をできるか更新する
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForMeld(p1, p2, discard, [...hands]); 

        // 全プレイヤーに情報を送る
        this.sendMeldMsgToAll(p1, 'kan', meld_info);
        
        // 嶺上牌を引く処理に移る（槍槓は発生しない）
        setTimeout(this.drawReplacementTile.bind(this), 10, 'kan'); 
    }


    /**
     * 暗槓を実行する
     * @param {String} socket_id   暗槓する人のsocket id
     * @param {Array} hands        手出しする牌
     */
    performAnkan(socket_id, hands){
        let p = this.#whoAction(socket_id);  

        // 正しいプレイヤーが正しい手牌を選んだかチェックする
        if (!(this.players[p].enable_actions.kan) || p != this.cplayer_idx){
            console.log("[ERROR, performAnkan, A] illegal action");
            return;
        }
        var ret = utils.canAnkan(this.players[p].getHands());
        if (!ret.some(sub => sub.length === hands.length && sub.every((e, i) => e === hands[i]))){
            console.log("[ERROR, performAnkan, B] illegal action");
            return;
        }

        // 暗槓を実行する（手牌からhandsを抜いてmeldを更新する）
        // meld_info = {'type': 'ankan', 'from_who': null, 'discard': null, hands: Array（タイルID）}
        let meld_info = this.players[p].performAnkan(hands);

        // kans（フィールド全体のカン管理リスト）を更新する
        this.kans.push({'player': p, 'from_who': null});

        // プレイヤーpがhands[0]で槓したことに対し、他プレイヤーが槍槓出来るかを確認
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForKan(p, hands[0], this.getFieldInfo()); 

        // 他プレイヤーからの宣言受け入れの準備
        this.declare_queue = [];           // プレイヤーからの宣言を貯めておくqueue
        this.can_declare_action = true;    // プレイヤーからの宣言を受け入れる状態にする
        const waiting_time = this.#getWaitTime() + 100;   // 何秒ほど待つべきか
        this.player_skip_responses = [...Array(4)].map((_,i) => !this.players[i].canAnyAction());  // 誰がアクションする可能性があるのか

        // 全プレイヤーに情報を送る
        this.sendMeldMsgToAll(p, 'ankan', meld_info);

        if (this.player_skip_responses.every(Boolean)){  // 誰も何もアクション出来ないので、すぐに次のツモにうつる
            this.timeout_id = setTimeout(this.drawReplacementTile.bind(this), waiting_time, "ankan");
        }
        else {   // 誰かが槍槓ロンする権利を持っているので、宣言可能時間を確保する
            this.next_process_info = {"func": this.drawReplacementTile, "opt": "ankan"};
            this.timeout_id = setTimeout(this.selectDeclaredAction.bind(this), waiting_time);
        }
    }


    /**
     * 加槓を実行する
     * @param {String} socket_id   加槓する人のsocket id
     * @param {Array} hands        手出しする牌
     */
    performKakan(socket_id, hand){
        let p = this.#whoAction(socket_id);  
 
        // 正しいプレイヤーが正しい手牌を選んだかチェックする
        if (!(this.players[p].enable_actions.kan) || p != this.cplayer_idx) {
            console.log("[ERROR, performKakan, A] illegal action");
            return;
        }
        var ret = utils.canKakan(this.players[p].getHands(), this.players[p].getMelds());
        if (!ret.includes(hand)){
            console.log("[ERROR, performKakan, B] illegal action");
            return;
        }

        // 加槓を実行する（手牌からhandを抜いてmeldを更新する）
        // meld_info = {'type': 'kakan', 'from_who': 相対SeatId, 'discard': タイルID, hands: Array（タイルID）}
        let meld_info = this.players[p].performKakan(hand);

        // kans（フィールド全体のカン管理リスト）を更新する
        this.kans.push({'player': p, 'from_who': (p + meld_info.from_who + 4) % 4});  

        // プレイヤーpがhandで槓したことに対し、他プレイヤーが槍槓出来るかを確認
        for(var i = 0; i < 4; i++) this.players[i].checkEnableActionsForKan(p, hand, this.getFieldInfo()); 

        // 他プレイヤーからの宣言受け入れの準備
        this.declare_queue = [];           // プレイヤーからの宣言を貯めておくqueue
        this.can_declare_action = true;    // プレイヤーからの宣言を受け入れる状態にする
        const waiting_time = this.#getWaitTime() + 100;   // 何秒ほど待つべきか
        this.player_skip_responses = [...Array(4)].map((_,i) => !this.players[i].canAnyAction());  // 誰がアクションする可能性があるのか

        // 全プレイヤーに情報を送る
        this.sendMeldMsgToAll(p, 'kakan', meld_info);

        if (this.player_skip_responses.every(Boolean)){  // 誰も何もアクション出来ないので、すぐに次のツモにうつる
            this.timeout_id = setTimeout(this.drawReplacementTile.bind(this), waiting_time, "ankan");
        }
        else {   // 誰かが槍槓ロンする権利を持っているので、宣言可能時間を確保する
            this.next_process_info = {"func": this.drawReplacementTile, "opt": "kakan"};
            this.timeout_id = setTimeout(this.selectDeclaredAction.bind(this), waiting_time);
        }
    }


    /**
     * 嶺上ツモを実行する  
     */
    drawReplacementTile(kan_type){
        // 槍槓ロンを無効にする
        this.can_declare_action = false; 

        // 4回槓された際の流局判定
        if (this.kans.length == 4) {
            // 全員が同じプレイヤーだったら続行する (5枚目のカンはどうする？） FIXME
            setTimeout(this.drawnGame.bind(this), 2000, [], true)
            return; 
        }

        let p = this.cplayer_idx; 

        // 王牌から1枚ドローする
        let replacement_tile = this.dead_tiles.pop();
        // 山牌から王牌に1枚追加する
        this.dead_tiles.push(this.tiles.pop());
        // ドラ追加
        this.dora.push(this.dead_tiles.pop());
        // カンした人に嶺上牌をひかせる
        this.players[p].drawTile(replacement_tile);

        // 全員の情報をアップデートする
        for (var i = 0; i < 4; i++) {
            this.players[i].checkEnableActionsForDrawReplacementTile(p, replacement_tile, kan_type, this.getFieldInfo());
        } 

        // 全プレイヤーにpが嶺上ツモした情報を送る
        this.sendDrawMsgToAll(p, replacement_tile, true);

        // 暗槓の場合は新ドラオープン、それ以外の場合は捨てた時にオープンする
        if (kan_type == 'ankan')
            this.sendDoraOpenMsgToAll();
        else
            this.is_open_next_dora = true;
    }  


    performRiichi(socket_id, discard_tile){
        // 正しい人が正しい牌を切ったかを判定
        let p = this.#whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.riichi) || p != this.cplayer_idx){
            console.log("[ERROR, performRiichi, A] illegal action");
            return;
        }
        var ret = utils.canRiichi(player.getHands(), player.getMelds());
        if (discard_tile === null) discard_tile = ret[0];  // FIXME
        if (!ret.includes(discard_tile)){
            console.log("[ERROR, performRiichi, B] 捨てられない牌を捨てた");
            return;
        }

        // 立直宣言
        player.performRiichi();
        // this.double_riichi_chance
        this.discardTile(socket_id, discard_tile);
    }


    /**
     * ツモあがりを実行する
     * @param {String} socket_id   ツモあがりする人のsocket id
     * @next forwardGame  FIXME : あがり画面に移行するようにする
     */
    performTsumo(socket_id){
        let p = this.#whoAction(socket_id);  
        let player = this.players[p];
        if (!(player.enable_actions.tsumo) || p != this.cplayer_idx){
            console.log("[ERROR, performTsumo, A] illegal action");
            return;
        }
        // 点数を取得する  FIXME
        
        // 次のゲームに進む
        this.timeout_id = setTimeout(this.forwardGame.bind(this), 2000, [p], false);
    }


    /**
     * ロンあがりを実行する（ロンは複数人が同時に行える）
     * @param {Array} ron_players    ロンあがりするプレイヤー（複数人OK）
     * @param {Number} roned_player  ロンあがりされたプレイヤー
     * @param {Number} roned_tile    ロンされた牌
     * @next forwardGame  FIXME : あがり画面に移行するようにする
     */
    performRon(ron_players, roned_player, roned_tile){
        console.log("Ron!!!");
        for (var i = 0; i < ron_players.length; i++){
            let ron_player = ron_players.player;
            // 点数を取得する  FIXME

        }
        // 次のゲームに進む
        this.timeout_id = setTimeout(this.forwardGame.bind(this), 2000, ron_players, false);
    }


    /**
     * 流局時の処理を実行する  FIXME : 流し満貫など
     * @param {Boolean} is_special  特殊な流れ方（九種九牌など）したか
     * @next forwardGame 
     */
    drawnGame(is_special = false){
        console.log("流局");
        this.timeout_id = setTimeout(this.forwardGame.bind(this), 2000, [], false);
    }


    /**
     * FIXME 
     * @returns 
     */
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

    
    /**
     * socket_idのプレイヤーの番号を取得する
     * @param {String or Number} socket_id  cpuの場合は、座席番号を送る
     * @returns プレイヤーの番号0～4、エラー時は-1
     */
    #whoAction(socket_id){
        // CPUの場合
        if(!isNaN(socket_id) && socket_id < 4)  
            return socket_id;
        // クライアントの場合
        for(var i = 0; i < this.players.length; i++){
            if (socket_id == this.players[i].getSocketId(i))
                return i;
        }
        console.log("[Error, whoAction, A] socket_id : %s", socket_id);
        return -1;
    }


    /**
     * p1がp2の捨てたdiscardをactionする予約がある際に、本当にそれが実行できるかチェックする
     * @param {String or Number} socket_id  この関数を実行したプレイヤー（p1と同じはず）
     * @param {Number} p1        予約済みのアクションするプレイヤー
     * @param {Number} p2        予約済みのアクションされるプレイヤー
     * @param {Number} discard   予約済みの鳴かれる牌
     * @param {String} action    アクションの種類（'pon', 'kan', 'chi'のいずれか）
     * @returns  実行可能：true, 実行不可能：false
     */
    #checkLegalActionForDiscardMeld(socket_id, p1, p2, discard, action){
        // この関数を呼んだ人は正しい？
        let p = this.#whoAction(socket_id);
        if (p1 != p){
            console.log(`[ERROR, perform${action}, A] player ${socket_id}(${p}) is not ${p1}`);
            return false;
        }
        // 捨牌は正しい？
        var tmp = this.players[p2].getDiscards();
        let _discard = tmp[tmp.length - 1];
        if (_discard != discard){
            console.log(`[ERROR, perform${action}, B] discard ${_discard} is not ${discard}`);
            return false;
        }
        // p1はactionを実行できる？
        if (!this.players[p1].enable_actions[action]){
            console.log(`[ERROR, perform${action}, C] player ${p1} can not do ${action}`);
            return false;
        }
        return true;
    }


    /**
     * プレイヤーのアクション可否と持ち時間から、何秒待つのが適切か計算して返す
     * @returns {Number} 待つべき時間
     */
    #getWaitTime(){
        let waiting_time = 0;
        for (var i = 0; i < 4; i++) {
            if (this.players[i].canAnyAction()){
                if (waiting_time < this.players[i].getAllottedTime() * 1000){
                    waiting_time = this.players[i].getAllottedTime() * 1000;
                }
            }
        }
        return waiting_time;
    }
    

    ///// クライアントに情報を送るメソッド群 /////

    /**
     * draw_playerがdraw_tileをツモしたことを全員に通知する
     * @param {Number} draw_player 
     * @param {Number} draw_tile 
     * @param {Boolean} is_replacement_draw  嶺上ツモかどうか、デフォルトfalse
     */
    sendDrawMsgToAll(draw_player, draw_tile, is_replacement_draw = false){
        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                player: (draw_player - i + 4) % 4,  // player iから見てどこか 
                action: (is_replacement_draw)? 'replacement-draw': 'draw', 
                tile: (draw_player == i)? draw_tile: this.secret_id, 
                remain_tile_num: this.tiles.length,
            });
        }
    }


    /**
     * discard_playerがdiscard_tileを捨てたことを全員に通知する
     * @param {*} draw_player 
     * @param {*} draw_tile 
     */
    sendDiscardMsgToAll(discard_player, discard_tile){
        // 全ユーザに情報を送る
        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                action: 'discard',  
                player: (discard_player - i + 4) % 4,  // player iから見てどこか
                tile: discard_tile,
            });
        }                
    }


    /**
     * action_playerが面子を公開したことを全員に通知する
     * @param {Number} action_player 
     * @param {String} action_type   'pon', 'chi', 'kan', 'ankan', 'kakan'のいずれか
     * @param {Array} meld_info      {'tgt_p': Number, 'discard': Number, 'hands': Array}
     */
    sendMeldMsgToAll(action_player, action_type, meld_info){
        for(var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                enable_actions: this.players[i].getEnableActions(), 
                player: (action_player - i + 4) % 4,  // player iから見てどこか 
                action: action_type, 
                meld: meld_info, 
            });
        }      
    }


    /**
     * 新ドラを全員に通知する
     */
    sendDoraOpenMsgToAll(){
        // ドラの情報を送る
        for (var i = 0; i < 4; i++){
            this.players[i].sendMsg('diff-data', {
                action: 'dora',  
                tile: this.dora[this.dora.length - 1], 
            });
        }
    }


    /**
     * declare_playerがaction_typeを宣言したことを全員に通知する
     * @param {*} declare_player 
     * @param {*} action_type 
     */
    sendDeclareMsgToAll(declare_player, action_type){
        for (var i = 0; i < 4; i++) {
            this.players[i].sendMsg('declare', {
                player: (declare_player - i + 4) % 4,  // player iから見てどこか
                action: action_type, 
            });
        }
    }


}

module.exports = Mahjong;
