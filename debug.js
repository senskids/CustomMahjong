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