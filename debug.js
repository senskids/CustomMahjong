exports.createTenhoTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    tiles[13] = 134;
    tiles[134] = 13;
    return tiles;
}


// 四風連打確認用
exports.createSufurendaTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);

    tiles[0] = 108;   // 東
    tiles[13] = 109;  // 東
    tiles[26] = 110;  // 東
    tiles[39] = 111;  // 東

    tiles[108] = 0;
    tiles[109] = 13;
    tiles[110] = 26;
    tiles[111] = 39;
    return tiles;
}


// 九種九牌確認用
exports.createNineDiffTerminalTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let tmp = [0, 32, 36, 68, 72, 104, 108, 112, 116, 120];
    for (var i = 0; i < tmp.length; i++){
        for (var j = 0; j < 4; j++){    
            u1 = j * 13 + i;
            u2 = tiles[tmp[i] + j];        
            tiles[u1] = u2;
            tiles[u2] = u1;
        }
    }
    return tiles;
}