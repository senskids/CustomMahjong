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


// 海底確認用
exports.createHaidiTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [ 0,  1,  2,  40,  44,  48,  76,  80, 84, 16, 17, 18, 52],
        [72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84],
        [36, 37, 38, 64, 65, 104, 100, 96, 88, 84, 80, 53, 54],
        [71, 70, 69, 31, 30, 29, 27, 26, 25, 23, 61, 62, 63]
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}


// 人和確認用
exports.createRenheTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 132], 
        [4, 8, 16, 17, 18, 24, 28, 32, 36, 40, 44, 76, 77],
        [1, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 128], 
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}


// 嶺上開花確認用
exports.createLingshangTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [40, 41, 42, 43, 4, 8, 12, 108, 109, 110, 133, 132, 60], 
        [124, 125, 16, 17, 18, 24, 28, 32, 36, 40, 44, 76, 77],
        [1, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 128], 
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}


// 流し満貫確認用
exports.createDrawnManganTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [0, 1, 2, 32, 33, 34, 36, 37, 38, 68, 69, 70, 72], 
        [124, 125, 16, 17, 18, 24, 28, 32, 36, 40, 44, 76, 77],
        [1, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 128], 
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}


// 嶺上開花大明槓責任払い確認用
exports.createLingshangBaojiaTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [0 ,  1,  2, 4, 8, 12, 108, 109, 110, 72, 76, 80, 60], 
        [3, 125, 16, 17, 18, 24, 28, 32, 36, 40, 44, 76, 77],
        [1, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 128], 
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}


// 大三元大明槓責任払い確認用
exports.createBaojiaTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    let inits = [
        [124, 125, 128, 129, 135, 134, 0, 1, 2, 4, 5, 6, 108], 
        [126, 130, 12, 17, 18, 24, 28, 32, 36, 40, 44, 76, 77],
        [1, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42],
        [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 128], 
    ];
    for (var p = 0; p < 4; p++){
        for (var i = 0; i < 13; i++)
            tiles[p * 13 + i] = inits[p][i];
    }
    return tiles;
}

