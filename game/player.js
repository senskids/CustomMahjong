const Mahjong = require('./mahjong');
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
        /** 現局の自風 0:東, 1:南, 2:西, 3:北 */
        this.cmenfeng = -1;
        /** 手牌（タイルID表現） */
        this.hands = [];
        /** 捨牌（タイルID表現） */
        this.discards = [];
        /** 立直した時の捨て牌のindex (何巡目に立直したか) */
        this.riichi_turn = null;
        /** 捨牌の自摸切りの有無  FIXME  実装していない */
        this.tumogiris = [];
        /** 鳴牌（鳴き牌表現） */
        this.melds = [];
        /** 局中（鳴かれた等関係なく）捨てた牌（牌表現） */
        this.essence_discards = [];
        /** 1順目か否か（鳴きで消失） */
        this.is_first_turn = true;
        /** 面前かどうか */
        this.is_menzen = true;             
        /** 聴牌しているか */
        this.is_tenpai = false;
        /** 立直しているか */
        this.is_riichi = false;
        /** ダブル立直かどうか */
        this.is_double_riichi = false;
        /** 一発状態にあるかどうか */
        this.is_oneshot = false;
        /** 現在、捨ててはいけない牌（タイルID表現） */
        this.forbidden_discards = [];
        /** フリテン状態か否か */
        this.is_furiten = false;
        /** 一時的なフリテン状態か否か */
        this.is_temporary_furiten = false;
        /** 流し満貫の権利があるか否か */
        this.is_drawn_mangan = true;
        /** 今上がった際の点数 FIXME */
        this.hule_info = undefined;
        /** 持ち時間  FIXME 実装していない */
        this.allotted_time = null;
        /** 時間管理用の変数 */
        this.time_start = null;
        /** プレイヤーが現在可能なアクションの辞書 */
        this.enable_actions = {
            discard: false, 
            pon: false, 
            chi: false, 
            ron: false, 
            riichi: false, 
            kan: false, 
            tsumo: false, 
            drawn: false,   // 九種九牌
            skip: false,    
        };
    }


    /**
     * 局の開始時に手牌、捨牌、鳴牌を初期化する
     * @param {Array} tiles            初期手牌 
     * @param {Number} parent_seat_id  親の座席
     */
    setInitialTiles(tiles, parent_seat_id){
        this.cmenfeng = [0, 3, 2, 1][this.getSeatRelationFromSeatId(parent_seat_id)];  // 現局の自風
        this.hands = [...tiles];
        this.melds = [];
        this.discards = [];
        this.riichi_turn = null;
        this.essence_discards = [];
        this.is_first_turn = true;
        this.is_menzen = true;             
        this.is_tenpai = false;
        this.is_riichi = false;
        this.is_double_riichi = false;
        this.is_oneshot = false;
        this.forbidden_discards = [];
        this.is_furiten = false;
        this.is_temporary_furiten = false;
        this.is_drawn_mangan = true;
        this.hule_info = undefined;
        this.resetEnableActions();
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
     * @param {Array} tile              捨てる牌（タイルID表現）
     * @param {Boolean} is_riichi_turn  立直したターンかどうか
     * @returns {Boolean, Boolean}      正しく捨てられたか否か, ツモ切りか否か
     */
    discardTile(tile, is_riichi_turn = false){
        if (this.forbidden_discards.includes(tile)){
            console.log("[ERROR, discardTile, B] 捨ててはいけない牌を捨てようとした");
            this.sendMsg('cannot-discard-tile', tile);
            return [false, false];
        }
        const idx = this.hands.indexOf(tile);
        if (idx < 0) {
            console.log("[ERROR, discardTile, C] 手牌にない牌を捨てようとした");
            this.sendMsg('cannot-discard-tile', null);
            return [false, false];
        }
        this.hands.splice(idx, 1);
        this.sortHands();
        this.discards.push(tile);
        this.essence_discards.push((utils.id2tile[tile][1] == "0")? `${utils.id2tile[tile][0]}5`: utils.id2tile[tile]);

        // 一時的な禁止捨牌を解除する
        if (!this.is_riichi && this.forbidden_discards.length > 0) this.forbidden_discards = [];
        // 一発判定
        if (!is_riichi_turn) this.is_oneshot = false;
        // 流し満貫判定
        if (!utils.yaojius.includes(utils.id2tile[tile])) this.is_drawn_mangan = false;

        // 聴牌およびフリテンの確認（立直してる場合は立直時にフリテン確認を行う）        
        this.is_temporary_furiten = false;
        if (!this.is_riichi) {
            this.is_furiten = false;
            const winning_tiles = utils.getWinningTiles(this.hands, this.melds, null);
            // あがれる牌があれば聴牌
            if (winning_tiles.length > 0){
                this.is_tenpai = true;
                // あがり牌を既に切っていればフリテン
                for(var i = 0; i < winning_tiles.length; i++) 
                    if (this.essence_discards.includes(winning_tiles[i])) this.is_furiten = true;
            }
        }
        // ツモあがりできたにも関わらず、牌を捨てた場合はフリテン
        if (this.enable_actions.tsumo) {
            this.is_temporary_furiten = true; 
            if (this.is_riichi) this.is_furiten = true;
        }
        return [true, idx == this.hands.length];
    }    


    /** FIXME field_info
     * seat_idの人がtileをツモした際に、enable_actionsを更新する
     * @param {Number} seat_id  ツモした人のシート番号（絶対値 0～4）
     * @param {Array} tile      ツモした牌（タイルID表現）
     */
    checkEnableActionsForDrawTile(seat_id, tile, field_info = null){
        // 何もできないで初期化
        this.resetEnableActions();
        // 自分のツモじゃなかったらreturn
        if (this.getSeatRelationFromSeatId(seat_id) != 0) return;
        
        // field_infoに自身の情報を付与する（嶺上ツモは別関数で処理するので、嶺上ツモで山牌が0になっても海底はつかない）
        field_info.menfeng = this.cmenfeng;
        if (this.is_riichi) field_info.hupai.lizhi = (this.is_double_riichi)? 2: 1;
        else field_info.fubaopai = [];
        if (this.is_oneshot) field_info.hupai.yifa = true;  // 一発
        if (this.is_first_turn) field_info.hupai.tianhu = (this.cmenfeng == 0)? 1: 2;
        if (field_info.tile_num == 0) field_info.hupai.haidi = 1;

        // 捨てることは絶対できる
        this.enable_actions.discard = true;
        // ツモあがり可能かチェック
        this.hule_info = utils.canTsumo(this.hands, this.melds, tile, field_info);
        if (this.hule_info != undefined && this.hule_info.defen != 0) this.enable_actions.tsumo = true;
        // リーチ可能かチェック
        if (this.is_menzen && !this.is_riichi && utils.canRiichi(this.hands, this.melds).length > 0 && field_info["tile_num"] >= 4 && this.point >= 1000) this.enable_actions.riichi = true;
        // 暗槓できるかチェック
        if (!this.is_riichi) { if (utils.canAnkan(this.hands).length > 0 && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true; }
        else { if (utils.canAnkanInRiichi(this.hands, this.melds, tile).length > 0 && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true; }
        // 加槓できるかチェック
        if (utils.canKakan(this.hands, this.melds).length > 0 && !this.is_riichi && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true;
        // 九種九牌できるかチェック
        if (this.is_first_turn && utils.canNineDiffTerminalTiles(this.hands)) this.enable_actions.drawn = true;
    }


    /** 
     * seat_idの人がtileを捨てた際に、enable_actionsを更新する
     * @param {Number} seat_id  捨てた人のシート番号（絶対値 0～4）
     * @param {Array} tile      捨牌（タイルID表現）
     */
    checkEnableActionsForDiscardTile(seat_id, tile, field_info = null){
        const seat_relation = this.getSeatRelationFromSeatId(seat_id);  // 0: 自分、1: 下家、2: 対面、3: 上家
        // 初期状態として何もしてはいけないをセット
        this.resetEnableActions();
        // 自分が捨てた場合はreturn
        if (seat_relation == 0) { 
            this.is_first_turn = false;
            return;
        }

        // field_infoに自身の情報を付与する
        field_info.menfeng = this.cmenfeng;
        if (this.is_riichi) field_info.hupai.lizhi = (this.is_double_riichi)? 2 : 1;
        else field_info.fubaopai = [];
        if (this.is_oneshot) field_info.hupai.yifa = true;         // 一発
        if (this.is_first_turn) field_info.hupai.tianhu = 3;       // 人和
        if (field_info.tile_num == 0) field_info.hupai.haidi = 2;  // 暗槓の捨牌などでも河底捨牌

        // 上家が捨てた場合のみ、チー出来るか判定
        if (seat_relation == 3) if (utils.canChi(this.hands, tile).length > 0 && !this.is_riichi && field_info["tile_num"] >= 1) this.enable_actions.chi = true;
        // ポン出来るか判定
        if (utils.canPon(this.hands, tile).length > 0 && !this.is_riichi && field_info["tile_num"] >= 1) this.enable_actions.pon = true;
        // カン出来るか判定
        if (utils.canKan(this.hands, tile).length > 0 && !this.is_riichi && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true;
        // ロン出来るか判定
        if (!this.is_furiten && !this.is_temporary_furiten){
            this.hule_info = utils.canRon(this.hands, this.melds, tile, seat_relation, field_info);
            if (this.hule_info != undefined && this.hule_info.defen != 0) this.enable_actions.ron = true;
        } 
        // 何かアクションを起こせるなら、スキップも押せるようにする  FIXME
        this.enable_actions.skip = this.canAnyAction();

        // フリテンの更新（この捨牌に対してはロン可能）
        if (this.enable_actions.ron) {
            this.is_temporary_furiten = true; 
            if (this.is_riichi) this.is_furiten = true;
        }
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
        this.resetEnableActions();
        // 1順目、一発の権利消失
        this.is_first_turn = false;
        this.is_oneshot = false;
        // 流し満貫の権利消失
        if (p2_seat_id == this.seat) this.is_drawn_mangan = false;
        if (seat_relation == 0) this.enable_actions.discard = true;
        return;
    }    


    /**
     * seat_idの人がtileを槓（暗槓or加槓）した際に、アクション（槍槓）ができるかチェックする
     * 槍槓は一発や人和と複合OK
     * @param {Number} seat_id    シート番号（絶対値 0～4）
     * @param {Array} tile        槓した牌（タイルID表現）
     * @param {Boolean} is_ankan  暗槓かどうか（暗槓の場合、国士無双だけできる）
     */
    checkEnableActionsForKan(seat_id, tile, is_ankan, field_info = null){
        this.resetEnableActions();
        const seat_relation = this.getSeatRelationFromSeatId(seat_id);  // 0: 自分、1: 下家、2: 対面、3: 上家
        if (seat_relation == 0) return;
        if (this.is_furiten || this.is_temporary_furiten) return;

        // field_infoに自身の情報を付与する（嶺上ツモは別関数で処理するので、嶺上ツモで山牌が0になっても海底はつかない）
        field_info.menfeng = this.cmenfeng;
        field_info.hupai.qianggang = true;  // 槍槓
        if (this.is_riichi) field_info.hupai.lizhi = (this.is_double_riichi)? 2 : 1;
        else field_info.fubaopai = [];
        if (this.is_oneshot) field_info.hupai.yifa = true;  // 一発
        if (this.is_first_turn) field_info.hupai.tianhu = 3;

        // ロン出来るか判定
        if (!this.is_furiten && !this.is_temporary_furiten){
            this.hule_info = utils.canRon(this.hands, this.melds, tile, seat_relation, field_info);
            if (this.hule_info != undefined && this.hule_info.defen != 0) {
                if (is_ankan){  // 国士無双だけ
                    let rets = []
                    for (var i = 0; i < this.hands.length; i++){
                        var v = utils.id2tile[this.hands[i]];
                        if (utils.yaojius.includes(v) && !rets.includes(v)) rets.push(v);
                    }
                    if (rets.length >= 12) this.enable_actions.ron = true;
                }
                else{
                    this.enable_actions.ron = true;
                }
            }
        } 

        // フリテンの更新（この捨牌に対してはロン可能）
        if (this.enable_actions.ron) {
            this.is_temporary_furiten = true; 
            if (this.is_riichi) this.is_furiten = true;
        }
    }


    /** FIXME field_info
     * seat_idの人がtileをツモした際に、enable_actionsを更新する
     * @param {Number} seat_id    ツモした人のシート番号（絶対値 0～4）
     * @param {Array} tile        ツモした牌（タイルID表現）
     * @param {String} kan_type   槓の種類（'kan', 'ankan', 'kakan'）
     */
    checkEnableActionsForDrawReplacementTile(seat_id, tile, kan_type, field_info = null){
        // 一発、天和の権利消失
        this.is_oneshot = false;
        this.is_first_turn = false;

        // 何もできないで初期化
        this.resetEnableActions();
        // 自分のツモじゃなかったらreturn
        if (this.getSeatRelationFromSeatId(seat_id) != 0) return;

        // field_infoに自身の情報を付与する（山牌が0でも海底はなし）
        field_info.menfeng = this.cmenfeng;
        field_info.hupai.lingshang = true;  // 嶺上
        if (this.is_riichi) field_info.hupai.lizhi = (this.is_double_riichi)? 2 : 1;

        // 捨てることは絶対できる
        this.enable_actions.discard = true;
        // ツモあがり可能かチェック
        this.hule_info = utils.canTsumo(this.hands, this.melds, tile, field_info);
        if (this.hule_info != undefined && this.hule_info.defen != 0) {
            this.enable_actions.tsumo = true;
            // 大明槓からの嶺上開花の場合、槓された人の責任払いにする
            if (kan_type == 'kan') {
                // this.hule_info.fenpeiにおいて誰が責任払いであるか
                let p1;  // fenpeiにおけるあがりプレイヤーの番号
                let minus_total_point = 0;  // fenpeiの-点数の合計
                for (var i = 0; i < 4; i++) {
                    if (this.hule_info.fenpei[i] > 0) p1 = i;
                    else {
                        minus_total_point += this.hule_info.fenpei[i];
                        this.hule_info.fenpei[i] = 0;
                    }
                }
                let p2 = (p1 + this.melds[this.melds.length - 1].from_who) % 4;  // 1:下家、2:対面、3:上家
                this.hule_info.fenpei[p2] = minus_total_point;
            }
        }
        if (kan_type == 'kan') return;  // 捨牌に対する槓なら捨てるか嶺上開花だけ
        // リーチ可能かチェック
        if (this.is_menzen && !this.is_riichi && utils.canRiichi(this.hands, this.melds).length > 0) this.enable_actions.riichi = true;
        // 暗槓できるかチェック
        if (utils.canAnkan(this.hands).length > 0 && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true;
        // 加槓できるかチェック
        if (utils.canKakan(this.hands, this.melds).length > 0 && field_info["kan_num"] < 4 && field_info["tile_num"] >= 1) this.enable_actions.kan = true;
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
        console.log(hand_tile);
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
                this.melds[i].hands.push(hand_tile);
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
    declareRiichi(hand_tile){
        this.is_riichi = true;
        this.is_tenpai = true;
        this.is_oneshot = true;
        if (this.is_first_turn) this.is_double_riichi = true;
        this.riichi_turn = this.discards.length;

        // ツモ牌以外切れなくする
        this.forbidden_discards = this.hands.filter(e => e != hand_tile);
        // フリテンの確認
        this.is_furiten = false;
        const winning_tiles = utils.getWinningTiles(this.hands.filter(e => e != hand_tile), this.melds, null);
        for(var i = 0; i < winning_tiles.length; i++) 
            if (this.essence_discards.includes(winning_tiles[i])) this.is_furiten = true;
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
    getEssenceDiscards(){
        return this.essence_discards;
    }
    getIsFirstTurn(){
        return this.is_first_turn;
    }
    getIsRiichi(){
        return this.is_riichi;
    }
    getRiichiTurn(){
        return this.riichi_turn;
    }
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
    getAllottedTime(){
        return this.allotted_time;
    }
    getEnableActions(){
        return this.enable_actions;
    }
    getOwnWind(){
        return ["東", "南", "西", "北"][this.seat];
    }
    getHuleInfo(){
        return this.hule_info;
    }
    getDrawnMangan(){
        return this.is_drawn_mangan;
    }
    getTenpai(){
        return this.is_tenpai;
    }
    resetStartTime(){
        this.time_start = Date.now();
    }
    updateAllottedTime(){
        // Data.now()はミリ秒単位
        console.log("updateAllottedTime", (Date.now() - this.time_start)/1000.0);
        if( (Date.now() - this.time_start)/1000.0 - this.game_manager.additional_allotted_time > 0) {
            this.allotted_time -= Math.floor((Date.now() - this.time_start)/1000.0) - this.game_manager.additional_allotted_time;
        }
        this.time_start = null;
    }
    /**
     * 点棒をやりとりする
     * @param {Number} diff_point  点棒の差分（+：もらう、-：払う）
     * @return {Boolean}  持ち点が0点以上かどうか（true：0点以上、false：マイナス）
     */
    setDiffPoint(diff_point){
        this.point += diff_point;
        return this.point >= 0;
    }
    setPoint(point = 25000) {
        this.point = point;
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
    resetEnableActions(){
        this.enable_actions = {discard: false, pon: false, chi: false, ron: false, riichi: false, kan: false, tsumo: false, drawn: false, skip: false};
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
        // console.log("[RandomAi] not implemented");

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
        else if (event === 'one-game-end') {
            setTimeout(this.sayConfirm.bind(this), 300);
        }
    }
    saySkip(){
        this.game_manager.notTurnPlayerDeclareAction(this.seat, "skip");
    }
    sayDiscard(){
        this.game_manager.discardTile(this.seat, this.hands[0]);
    }
    sayConfirm(){
        this.game_manager.doConfirm(this.seat);
    }
}

module.exports = Player;
