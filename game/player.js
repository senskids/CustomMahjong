const utils = require('./utils');

class Player{

    constructor(game_manager, socket, socket_id, user_id, user_name){
        /** Mahjongクラスインスタンスへの参照 */ 
        this.game_manager = game_manager;
        /** ユーザが今アクティブかどうか（非アクティブの場合はAIが打つ）  */
        this.is_active = true;
        /** Socket Object */
        this.socket = socket;
        /** ユーザとのSocket通信のID */
        this.socket_id = socket_id;
        /** ユーザのuser_id（キー） */
        this.user_id = user_id;
        /** ユーザの名前 */
        this.user_name = user_name;
        /** 座席の場所 0:東, 1:南, 2:西, 3:北 */
        this.seat = -1;
        /** 現在の点棒 */
        this.point = 25000;
        /** 手牌（タイルID表現） */
        this.hands = [];
        /** 捨牌（タイルID表現） */
        this.discards = [];
        /** 捨牌の自摸切りの有無  FIXME  実装していない */
        this.tumogiris = [];
        /** 鳴牌（鳴き牌表現） */
        this.melds = [];
        /** 面前かどうか */
        this.is_menzen = true;             
        /** リーチしているか */
        this.is_riichi = false;
        /** 聴牌しているか */
        this.is_tenpai = false;
        /** 現在、捨ててはいけない牌（タイルID表現） */
        this.forbidden_discards = [];
        /** 持ち時間  FIXME 実装していない */
        this.allotted_time = 10;
        /** プレイヤーが現在可能なアクションの辞書 */
        this.enable_actions = {
            discard: false, 
            pon: false, 
            chi: false, 
            ron: false, 
            riichi: false, 
            kan: false, 
            tsumo: false, 
            skip: false,      // FIXME 九種九牌なども
        };
    }


    /**
     * 局の開始時に手牌、捨牌、鳴牌を初期化する
     * @param {Array} tiles  初期手牌 
     */
    setInitialTiles(tiles){
        this.hands = [...tiles];
        this.melds = [];
        this.discards = [];
        this.is_menzen = true;             
        this.is_riichi = false;
        this.is_tenpai = false;
        this.forbidden_discards = [];
        this.enable_actions = {
            discard: false, 
            pon: false, 
            chi: false, 
            ron: false, 
            riichi: false, 
            kan: false, 
            tsumo: false, 
            skip: false,
        };
        this.sortHands();
    }


    /**
     * 山牌からツモして手牌に加える
     * @param {Array} tile  ツモする牌（タイルID表現）
     */
    drawTile(tile){ 
        this.hands.push(tile);
    }


    /**
     * 手牌からtileを捨てる
     * @param {Array} tile  捨てる牌（タイルID表現）
     * @returns 正しく捨てられたか否か
     */
    discardTile(tile){
        if (this.forbidden_discards.includes(tile)){
            console.log("[ERROR, discardTile, B] 捨ててはいけない牌を捨てようとした");
            this.sendMsg('cannot-discard-tile', tile);
            return false;
        }
        const idx = this.hands.indexOf(tile);
        if (idx < 0) {
            console.log("[ERROR, discardTile, C] 手牌にない牌を捨てようとした");
            this.sendMsg('cannot-discard-tile', null);
            return false;
        }
        this.hands.splice(idx, 1);
        this.sortHands();
        this.discards.push(tile);

        // 一時的な禁止捨牌を解除する
        if (!this.is_riichi && this.forbidden_discards.length > 0) this.forbidden_discards = [];

        return true;
    }    
    

    /** FIXME field_info
     * seat_idの人がtileをツモした際に、enable_actionsを更新する
     * @param {Number} seat_id  ツモした人のシート番号（絶対値 0～4）
     * @param {Array} tile      ツモした牌（タイルID表現）
     */
    checkEnableActionsForDrawTile(seat_id, tile, field_info = null){
        // 何もできないで初期化
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, skip: false};
        // 自分のツモじゃなかったらreturn
        if (this.getSeatRelationFromSeatId(seat_id) != 0) return;
        // 捨てることは絶対できる
        this.enable_actions.discard = true;
        // ツモあがり可能かチェック
        if (utils.canTsumo(this.hands, this.melds, tile, field_info)) this.enable_actions.tsumo = true;
        // リーチ可能かチェック
        if (this.is_menzen && !this.is_riichi && utils.canRiichi(this.hands, this.melds).length > 0) this.enable_actions.riichi = true;
        // 暗槓できるかチェック
        if (!this.is_riichi) { if (utils.canAnkan(this.hands).length > 0) this.enable_actions.kan = true; }
        else { if (utils.canAnkanInRiichi(this.hands, this.melds, tile).length > 0) this.enable_actions.kan = true; }
        // 加槓できるかチェック
        if (utils.canKakan(this.hands, this.melds).length > 0 && !this.is_riichi) this.enable_actions.kan = true;
    }


    /** FIXME field_info, ラスツモなら槓できない等
     * seat_idの人がtileを捨てた際に、enable_actionsを更新する
     * @param {Number} seat_id  捨てた人のシート番号（絶対値 0～4）
     * @param {Array} tile      捨牌（タイルID表現）
     */
    checkEnableActionsForDiscardTile(seat_id, tile, field_info = null){
        const seat_relation = this.getSeatRelationFromSeatId(seat_id);  // 0: 自分、1: 下家、2: 対面、3: 上家
        // 初期状態として何もしてはいけないをセット
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, skip: false};
        if (this.is_riichi) field_info.hupai.riichi = 1;
        // 自分が捨てた場合はreturn
        if (seat_relation == 0) return;     
        // 上家が捨てた場合のみ、チー出来るか判定
        if (seat_relation == 3) if (utils.canChi(this.hands, tile).length > 0 && !this.is_riichi) this.enable_actions.chi = true;
        // ポン出来るか判定
        if (utils.canPon(this.hands, tile).length > 0 && !this.is_riichi) this.enable_actions.pon = true;
        // カン出来るか判定
        if (utils.canKan(this.hands, tile).length > 0 && !this.is_riichi) this.enable_actions.kan = true;
        // ロン出来るか判定
        if (utils.canRon(this.hands, this.melds, tile, seat_relation, field_info) > 0) this.enable_actions.ron = true;
        // 何かアクションを起こせるなら、スキップも押せるようにする  FIXME
        this.enable_actions.skip = this.canAnyAction();
    }


    /** 
     * p1_seat_idの人がp2_seat_idの人からdiscardを鳴いて、discard + handsを面子として公開した際に、enable_actionsを更新する
     * @param {Number} p1_seat_id    鳴いた人のシート番号（絶対値 0～4）
     * @param {Number} p2_seat_id    鳴かれた人のシート番号（絶対値 0～4）
     * @param {Number} discard       鳴かれた牌（タイルID表現）
     * @param {Array} hands          鳴いた人の手牌から出た牌（タイルID表現）
     */
    checkEnableActionsForMeld(p1_seat_id, p2_seat_id, discard, hands){
        const seat_relation = this.getSeatRelationFromSeatId(p1_seat_id);  // 0: 自分、1: 下家、2: 対面、3: 上家
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, skip: false};
        if (seat_relation == 0) this.enable_actions.discard = true;
        return;
    }    


    /** FIXME : Not implemented
     * seat_idの人がtileを槓（暗槓or加槓）した際に、アクション（槍槓）ができるかチェックする
     * @param {Number} seat_id    シート番号（絶対値 0～4）
     * @param {Array} tile        槓した牌（タイルID表現）
     * @param {Boolean} is_ankan  暗槓かどうか（暗槓の場合、国士無双だけできる）
     */
    checkEnableActionsForKan(seat_id, tile, is_ankan){
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, skip: false};
        // if (utils.canRon(this.hands, this.melds, seat_relation, tile, field_info) > 0) this.enable_actions.ron = true;
        console.log("[checkEnableActionsForKakanTile] not implemented");
    }


    /** FIXME field_info
     * seat_idの人がtileをツモした際に、enable_actionsを更新する
     * @param {Number} seat_id    ツモした人のシート番号（絶対値 0～4）
     * @param {Array} tile        ツモした牌（タイルID表現）
     * @param {String} kan_type   槓の種類（'kan', 'ankan', 'kakan'）
     */
    checkEnableActionsForDrawReplacementTile(seat_id, tile, kan_type, field_info = null){
        // 何もできないで初期化
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, skip: false};
        // 自分のツモじゃなかったらreturn
        if (this.getSeatRelationFromSeatId(seat_id) != 0) return;
        // 捨てることは絶対できる
        this.enable_actions.discard = true;
        if (kan_type == 'kan') return;  // 捨牌に対する槓なら捨てるだけ
        // ツモあがり可能かチェック
        if (utils.canTsumo(this.hands, this.melds, tile, field_info)) this.enable_actions.tsumo = true;
        // リーチ可能かチェック
        if (this.is_menzen && !this.is_riichi && utils.canRiichi(this.hands, this.melds).length > 0) this.enable_actions.riichi = true;
        // 暗槓できるかチェック
        if (utils.canAnkan(this.hands).length > 0) this.enable_actions.kan = true;
        // 加槓できるかチェック
        if (utils.canKakan(this.hands, this.melds).length > 0) this.enable_actions.kan = true;
    }


    /** 
     * 他家の捨牌から鳴きを実行する（handsとmeldsを更新する）  FIXME : 喰い変えも実装する
     * @param {String} meld_type     'pon', 'kan', 'chi'のいずれか
     * @param {Number} seat_id       シート番号（絶対値 0～4）
     * @param {Array} hand_tiles     手牌から抜き出す牌の配列（タイルID表現）
     * @param {Number} discard_tile  捨てられた牌のタイルID表現
     * @returns  meld_info = {'type': String, 'from_who': 相対SeatID, 'discard': タイルID, 'hands': Array（タイルID）}
     */
    #performMeld(meld_type, seat_id, hand_tiles, discard_tile){
        this.hands = this.hands.filter(e => !hand_tiles.includes(e));
        let meld_info = {
            type: meld_type, 
            from_who: this.getSeatRelationFromSeatId(seat_id),  // このプレイヤーから見て1:下家、2:対面、3:上家
            discard: discard_tile, 
            hands: [...hand_tiles], 
        };
        this.is_menzen = false;
        this.melds.push(meld_info);

        // 喰い変えを防止する
        let forbidden_cands = utils.getForbiddenTilesForMeld(hand_tiles, discard_tile, meld_type);
        this.forbidden_discards = this.hands.filter(e => forbidden_cands.includes(e));

        return meld_info; 
    }


    /** 
     * 他家の捨牌からポンを実行する（handsとmeldsを更新する）
     * @param {Number} seat_id       シート番号（絶対値 0～4）
     * @param {Array} hand_tiles     手牌から抜き出す牌の配列（タイルID表現）
     * @param {Number} discard_tile  捨てられた牌のタイルID表現
     * @returns  meld_info = {'type': 'pon', 'from_who': 相対SeatID, 'discard': タイルID, 'hands': Array（タイルID）}
     */
    performPon(seat_id, hand_tiles, discard_tile){
        return this.#performMeld('pon', seat_id, hand_tiles, discard_tile);
    }

    
    /** 
     * 他家の捨牌からチーを実行する（handsとmeldsを更新する）
     * @param {Number} seat_id       シート番号（絶対値 0～4）
     * @param {Array} hand_tiles     手牌から抜き出す牌の配列（タイルID表現）
     * @param {Number} discard_tile  捨てられた牌のタイルID表現
     * @returns  meld_info = {'type': 'chi', 'from_who': 3, 'discard': タイルID, 'hands': Array（タイルID）}
     */
    performChi(seat_id, hand_tiles, discard_tile){
        return this.#performMeld('chi', seat_id, hand_tiles, discard_tile);
    }
    

    /** 
     * 他家の捨牌からカンを実行する（handsとmeldsを更新する）
     * @param {Number} seat_id       シート番号（絶対値 0～4）
     * @param {Array} hand_tiles     手牌から抜き出す牌の配列（タイルID表現）
     * @param {Number} discard_tile  捨てられた牌のタイルID表現
     * @returns  meld_info = {'type': 'kan', 'from_who': 相対SeatID, 'discard': タイルID, 'hands': Array（タイルID）}
     */
    performKan(seat_id, hand_tiles, discard_tile){
        return this.#performMeld('kan', seat_id, hand_tiles, discard_tile);
    }


    /** 
     * 暗槓を実行する（手牌から牌を抜き出し、公開牌に追加する（ツモはしない）
     * @param {Array} hand_tiles     手牌から抜き出す牌の配列（タイルID表現）
     * @returns  meld_info = {'type': 'ankan', 'from_who': null, 'discard': null, 'hands': Array（タイルID）}
     */
    performAnkan(hand_tiles){
        this.hands = this.hands.filter(e => !hand_tiles.includes(e));
        let meld_info = {
            type: 'ankan', 
            from_who: null,  // 自分で4枚集めたことを明示
            discard: null, 
            hands: [...hand_tiles], 
        };
        this.melds.push(meld_info);
        return meld_info;
    }


    /**
     * 加槓を実行する（handsとmeldsを更新する）
     * @param {Number} hand_tile   手牌から抜き出す牌（タイルID表現）
     * @returns  meld_info = {'type': 'kakan', 'from_who': 相対SeatId, 'discard': タイルID, hands: Array（タイルID）}
     */
    performKakan(hand_tile){   
        this.hands = this.hands.filter(e => e != hand_tile);
        for (var i = 0; i < this.melds.length; i++){
            let meld = this.melds[i];
            if (meld.type != 'pon') continue;
            var t1 = utils.id2tile[meld.discard];
            var t2 = utils.id2tile[hand_tile];
            if (t1[1] == '0') t1[1] == '5';
            if (t2[1] == '0') t2[1] == '5';
            if (t1 == t2){
                this.melds[i].type = 'kakan';
                this.melds[i].hands.concat(hand_tile);
                return this.melds[i];
            }
        }
        console.log("[ERROR, performKakan, A] not found");
        return null;
    }


    /** 
     * 立直を実行する（内部を立直状態にする）
     * @param {Number} hand_tile   手牌から抜き出す牌（タイルID表現）
     */
    performRiichi(hand_tile){
        this.is_riichi = true;
        this.forbidden_discards = this.hands.filter(e => e != hand_tile);
        return;
    }


    /////////////////////////////////////////////
    //////////// ゲッター・セッター /////////////
    /////////////////////////////////////////////
    setSeat(seat_id){
        this.seat = seat_id;
    }
    getPoint(){
        return this.point;
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
        return (this.is_active)? this.user_name+"<br>"+this.getOwnWind(this.seat): this.user_name + "(cpu)"+"<br>"+this.getOwnWind(this.seat);
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
    getAllottedTime(){
        return this.allotted_time;
    }
    getEnableActions(){
        return this.enable_actions;
    }
    getOwnWind(user_wind){
        switch(this.seat){
            case 0:
                user_wind = "東";
                break;
            case 1:
                user_wind = "南";
                break;
            case 2:
                user_wind = "西";
                break;
            case 3:
                user_wind = "北";
                break;
        }
        return user_wind;
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
    /**
     * プレイヤーにソケット通信する
     * @param {String} event  event名
     * @param {*} data        送信するデータ
     */
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
            else if (data['action'] == 'draw'){
                if (data['enable_actions']["discard"]){
                    setTimeout(this.sayDiscard.bind(this), 500);
                }
            }
        }
    }
    saySkip(){
        this.game_manager.notTurnPlayerDeclareAction(this.seat, "skip");
    }
    sayDiscard(){
        this.game_manager.discardTile(this.seat, this.hands[0]);
    }
}

module.exports = Player;
