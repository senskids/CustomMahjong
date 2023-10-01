const utils = require('./utils');

class Player{
    constructor(game_manager, socket, socket_id, user_id, user_name){
        this.game_manager = game_manager;  // Mahjongクラスインスタンスへの参照
        this.is_active = true;             // ユーザが今アクティブかどうか（非アクティブの場合はAIが打つ）
        this.socket = socket;              // Socket Object
        this.socket_id = socket_id;        // ユーザとのSocket通信のID
        this.user_id = user_id;            // ユーザのuser_id（キー）
        this.user_name = user_name;        // ユーザの名前
        this.seat = -1;                    // 座席の場所 0:東, 1:南, 2:西, 3:北
        this.point = 25000;                // 現在の点棒
        this.hands = [];                   // 手牌
        this.discards = [];                // 捨牌
        this.tumogiris = [];               // 捨牌の自摸切りの有無  FIXME  実装していない
        this.melds = [];                   // 鳴牌
        this.is_menzen = true;             // 面前かどうか  // 名前check
        this.is_riichi = false;            // リーチしているか
        this.is_tenpai = false;            // 聴牌しているか
        this.allotted_time = -1;           // 持ち時間
        this.enable_actions = {            // 可能なアクション
            discard: false, 
            pon: false, 
            chi: false, 
            ron: false, 
            riichi: false, 
            kan: false, 
            skip: false,                   // 考える, 九種九牌なども
        };
    }

    // 配牌する
    setInitialTiles(tiles){
        this.hands = [...tiles];
        this.melds = [];
        this.discards = [];
        this.sortHands();
    }

    // ツモする
    drawTile(tile, is_replacement = false){  
        this.hands.push(tile);
    }

    // 手牌から牌を捨てる
    discardTile(tile){
        const idx = this.hands.indexOf(tile);
        if (idx < 0) return "Null";
        this.hands.splice(idx, 1);
        this.sortHands();
        this.discards.push(tile);
        return tile;
    }    
    
    // 自分がtileをツモした際に、何のアクションができるかチェックする
    checkEnableActionsForDrawTile(tile, is_replacement = false, field_info = null){
        // 捨てることは絶対できる
        this.enable_actions = {discard: true, pon: false, chi: false, ron: false, riichi: false, kan: false, skip: false};
        // ツモあがり可能かチェック
        if (utils.canTsumo(this.hands, this.melds, tile, field_info)) this.enable_actions.tsumo = true;
        // リーチ可能かチェック
        if (this.is_menzen && utils.canRiichi(this.hands, this.melds).length > 0) this.enable_actions.riichi = true;
        // 暗槓できるかチェック
        if (utils.canAnkan(this.hands).length > 0) this.enable_actions.kan = true;
        // 加槓できるかチェック
        if (utils.canKakan(this.hands, this.melds).length > 0) this.enable_actions.kan = true;
    }

    // seat_idの人がtileを捨てた際に、何のアクションができるかチェックする
    checkEnableActionsForDiscardTile(seat_id, tile, field_info = null){
        const seat_relation = this.getSeatRelationFromSeatId(seat_id);  // 0: 自分、1: 下家、2: 対面、3: 上家
        // 初期状態として何もしてはいけないをセット
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, skip: false};
        // 自分が捨てた場合はreturn
        if (seat_relation == 0) return;     
        // 上家が捨てた場合のみ、チー出来るか判定
        if (seat_relation == 3) if (utils.canChi(this.hands, tile).length > 0) this.enable_actions.chi = true;
        // ポン出来るか判定
        if (utils.canPon(this.hands, tile).length > 0) this.enable_actions.pon = true;
        // カン出来るか判定
        if (utils.canKan(this.hands, tile).length > 0) this.enable_actions.kan = true;
        // ロン出来るか判定
        if (utils.canRon(this.hands, this.melds, tile, seat_relation, field_info) > 0) this.enable_actions.ron = true;
        // 何かアクションを起こせるなら、スキップも押せるようにする  FIXME
        this.enable_actions.skip = this.canAnyAction();
    }

    // seat_idの人がtileを加槓した際に、アクション（槍槓）ができるかチェックする
    checkEnableActionsForKakanTile(seat_id, tile){
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, skip: false};
        // if (utils.canRon(this.hands, this.melds, seat_relation, tile, field_info) > 0) this.enable_actions.ron = true;
        console.log("[checkEnableActionsForKakanTile] not implemented");
    }

    /// 他家の捨牌から鳴きを実行する
    // meld_type : 'pon', 'kan', 'chi'のいずれか
    // seat_id : 鳴かれた人のシートのid
    // hand_tiles: 手牌から抜き出す牌（idのリスト）
    // discard_Tile: 河から拾って来る牌のid
    performMeld(meld_type, seat_id, hand_tiles, discard_tile){
        this.hands = this.hands.filter(e => !hand_tiles.includes(e));
        let meld_info = {
            type: meld_type, 
            from_hands: [...hand_tiles], 
            from_discard: discard_tile, 
            from_who: this.getSeatRelationFromSeatId(seat_id)  // このプレイヤーから見て1:下家、2:対面、3:上家
        };
        this.is_menzen = false;
        this.melds.push(meld_info);
    }

    /// 暗槓を実行する
    // hand_tiles: [X, X+1, X+2, X+3] 槓をする4枚の牌のidの配列
    performAnkan(hand_tiles){
        this.hands = this.hands.filter(e => !hand_tiles.includes(e));
        let meld_info = {
            type: 'ankan', 
            from_hands: [...hand_tiles], 
            from_discard: null, 
            from_who: 0  // 自分で4枚集めたことを明示
        };
        this.melds.push(meld_info);
    }

    /// 加槓を実行する
    // hand_tile: meldsのponに付け加える牌のid
    performKakan(hand_tile){   
        this.hands = this.hands.filter(e => e != hand_tile);
        for (var i = 0; i < this.melds.length; i++){
            let meld = this.melds[i];
            if (meld.type == 'pon' && utils.id2tile[meld.from_discard].slice(0, 2) == utils.id2tile[hand_tile].slice(0, 2)){
                this.melds[i].type = 'kakan';
                this.melds[i].hands.concat(hand_tile);
            }
        }
    }

    // 立直を実行する  FIXME 1000点出すのはどこでする？
    performRiichi(discard_tile){
        this.is_riichi = true;
        return this.discardTile(discard_tile);
    }

    /////////////////////////////////////////////
    //////////// ゲッター・セッター /////////////
    /////////////////////////////////////////////
    setSeat(seat_id){
        this.seat = seat_id;
    }
    getHands(){
        return this.hands;
    };
    getDiscards(){
        return this.discards;
    };
    getMelds(){
        return this.melds;
    };    
    getSocketId(){
        return this.socket_id;
    }
    getUserId(){
        return this.user_id;
    }
    getUserName(){
        return (this.is_active)? this.user_name: this.user_name + "(cpu)";
    }
    getActive(){
        return this.is_active;
    }
    setActive(_active){
        this.is_active = _active;
        if (!this.is_active){
            this.socket_id = null;
        }
    }
    setSocketId(socket_id){
        this.socket_id = socket_id;
    }
    setUserId(user_id){
        this.user_id = user_id;
    }
    setUserName(user_name){
        this.user_name = user_name;
    }
    getEnableActions(){
        return this.enable_actions;
    }

    /////////////////////////////////////////////
    /////////////////// Utils ///////////////////
    /////////////////////////////////////////////
    canAnyAction(){
        if (this.enable_actions.chi) return true;
        if (this.enable_actions.pon) return true;
        if (this.enable_actions.kan) return true;
        if (this.enable_actions.ron) return true;
        return false;
    }
    sortHands(){
        this.hands.sort((a, b) => a - b);
    }
    // 自分からみてseat_idの人は自分(0)、下家(1)、対面(2)、上家(3)かを取得する
    getSeatRelationFromSeatId(seat_id){
        return (seat_id - this.seat + 4) % 4;
    }

    /////////////////////////////////////////////
    //////////////// Socket通信 /////////////////
    /////////////////////////////////////////////
    sendMsg(event, data){
        if (this.socket_id != null){
            this.socket.to(this.socket_id).emit(event, data);
            console.log("[SendMsg]");
            console.log(" - client : %s", this.user_name);
            console.log(" - event : %s", event);
            console.log(" - data : %s", data);
            console.log(" - dataSize : %s bytes", Buffer.byteLength(JSON.stringify(data)));
        }
        else 
            this.RandomAi(event, data);
    }

    /////////////////////////////////////////////
    /// AI（FIXME: 別のファイルに移行したい） ///
    /////////////////////////////////////////////
    RandomAi(event, data){
        // 行動できるアクションからランダムで選ぶ
        console.log("[RandomAi] not implemented");

        if (event === 'diff-data'){
            if (data['action'] == 'discard'){
                if (data['enable_actions']["skip"]) {
                    setTimeout(this.saySkip.bind(this), 300);
                }
            }
        }
    }
    saySkip(){
        console.log("saySkip");
        this.game_manager.declareAction(this.seat, "skip");
    }
}

module.exports = Player;
