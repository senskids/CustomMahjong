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


// 4カン確認用
exports.createFourKanTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    tiles[62] = 13;
    tiles[63] = 14;
    tiles[64] = 15;
    tiles[13] = 62;
    tiles[14] = 63;
    tiles[15] = 64;
    return tiles;
}


// 4人全員立直確認用
exports.createAllRiichiTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [ 0,  1,  2,  4,  5,  6,  8,  9, 10, 16, 17, 18, 130],
        [36, 37, 38, 40, 41, 42, 44, 45, 46, 52, 53, 54, 131],
        [72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
        [71, 70, 69, 31, 30, 29, 27, 26, 25, 23, 61, 62, 63]
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}