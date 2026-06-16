import React, { useState, useCallback } from "react";

// ─── ESTADO PERSISTENTE EN PDF (texto oculto) ───────────────────────────────
const COTBC_PREFIX = "COTBC1:";
const COTBC_SUFFIX = ":COTBCEND";

function loadScript(src, globalName) {
  return new Promise(function(resolve, reject) {
    if (window[globalName]) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = function() { resolve(); };
    s.onerror = function() { reject(new Error("No se pudo cargar: " + src)); };
    document.head.appendChild(s);
  });
}

async function compressState(state) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js", "LZString");
  const json = JSON.stringify(state);
  const arr = window.LZString.compressToUint8Array(json);
  let hex = "";
  for (let i = 0; i < arr.length; i++) { hex += arr[i].toString(16).padStart(2, "0"); }
  return COTBC_PREFIX + hex + COTBC_SUFFIX;
}

async function decompressState(blob) {
  if (!blob) return null;
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js", "LZString");
  function tryDecode(hexStr) {
    let inner = hexStr.toLowerCase().replace(/[^0-9a-f]/g, "");
    if (inner.length % 2 !== 0) inner = inner.slice(0, inner.length - 1);
    if (inner.length < 4) return null;
    try {
      const bytes = new Uint8Array(inner.length / 2);
      for (let i = 0; i < bytes.length; i++) { bytes[i] = parseInt(inner.substr(i * 2, 2), 16); }
      const json = window.LZString.decompressFromUint8Array(bytes);
      if (!json) return null;
      return JSON.parse(json);
    } catch(e) { return null; }
  }
  try {
    let inner = blob;
    if (inner.indexOf(COTBC_PREFIX) !== -1) inner = inner.slice(inner.indexOf(COTBC_PREFIX) + COTBC_PREFIX.length);
    if (inner.indexOf(COTBC_SUFFIX) !== -1) inner = inner.slice(0, inner.indexOf(COTBC_SUFFIX));
    // Intento principal: todo el hex junto
    const r1 = tryDecode(inner);
    if (r1) return r1;
    return null;
  } catch(e) { return null; }
}

// Lee TODO el texto de un PDF y extrae el bloque de estado comprimido
async function readStateFromPDF(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", "pdfjsLib");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    content.items.forEach(function(it){
      const s = it.str || "";
      // Descartar items que son basura del pie de página agregada por el visor
      if (s.indexOf("data:text/html") !== -1) return;
      if (s.indexOf("Cotizacion_TBC") !== -1) return;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s.trim())) return; // fecha tipo 15/6/26
      if (/^\d{1,2}:\d{2}/.test(s.trim())) return; // hora tipo 11:11
      if (/^\d+\/\d+$/.test(s.trim())) return; // número de página tipo 2/3
      fullText += s;
    });
  }
  const start = fullText.indexOf(COTBC_PREFIX);
  const end = fullText.indexOf(COTBC_SUFFIX);
  if (start === -1 || end === -1 || end < start) return null;
  return fullText.slice(start, end + COTBC_SUFFIX.length);
}

const PRODUCT_IMAGES = {
  "PREMIUM SCREEN": "https://res.cloudinary.com/dthqt2tph/image/upload/per_9_xxvk5q",
  "LUXURY ROLLERS": "https://res.cloudinary.com/dthqt2tph/image/upload/per_4_es6i7a",
  "PREMIUM BLACKOUT": "https://res.cloudinary.com/dthqt2tph/image/upload/Persianas-Black-Out_ryfagv",
  "LUXURY DUAL CRYSTALLINE": "https://res.cloudinary.com/dthqt2tph/image/upload/1492c0_6c2194d79f10492694246008757e828a_mv2_wxdihk",
  "LUXURY DUAL OPAQUE": "https://res.cloudinary.com/dthqt2tph/image/upload/dual_balckout_wda6gz",
  "SHANGRI-LA": "https://res.cloudinary.com/dthqt2tph/image/upload/shangri_la_zxnh8j",
  "CORTINA_BLACKOUT": "https://res.cloudinary.com/dthqt2tph/image/upload/BLACKOOUT_2_zdskjz",
  "CORTINA_VELO": "https://res.cloudinary.com/dthqt2tph/image/upload/cor_5_kbaq0t",
  "TOLDO VERTICAL": "https://res.cloudinary.com/dthqt2tph/image/upload/toldo_Vertical_nqlopg",
  "PÉRGOLA BRAZO EXTENSIBLE": "https://res.cloudinary.com/dthqt2tph/image/upload/pergola_brazo_extensible_txvxek",
  "CENEFA_CASETTE": "https://res.cloudinary.com/dthqt2tph/image/upload/cenefa_cassette_rvu03p",
  "CENEFA_PVC": "https://res.cloudinary.com/dthqt2tph/image/upload/cenefa_pcv_ukrtew",
  "CONTROL_TBC": "https://res.cloudinary.com/dthqt2tph/image/upload/control_tbc_f2qh7i",
  "CONTROL_SOMFY": "https://res.cloudinary.com/dthqt2tph/image/upload/control_somfy_uovdl6",
};

// ─── PRICE TABLES ─────────────────────────────────────────────────────────────
const TABLES = {
  "LUXURY DUAL CRYSTALLINE": { mult:0.55, W:[91,106,121,137,152,167,182,198,213,228,243,259,274], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], T:[[250,279,308,347,377,418,450,482,500,531,562,577,607],[260,292,324,365,398,442,476,510,528,561,594,608,640],[272,305,339,383,418,466,502,538,556,591,626,639,673],[284,319,354,402,438,490,528,566,584,621,657,670,705],[295,332,369,420,458,514,554,594,612,651,689,701,738],[307,346,384,438,479,538,580,622,640,681,721,733,771],[319,359,399,457,499,562,606,650,668,710,753,764,804],[330,373,415,475,519,585,637,678,696,740,785,795,807],[342,386,430,493,540,609,658,705,724,770,816,825,870],[353,399,445,511,560,633,684,734,752,800,848,857,903],[365,413,460,530,580,657,701,752,780,830,880,888,936],[377,426,475,548,600,681,735,790,808,860,912,919,969],[388,439,490,566,620,705,761,818,836,890,944,950,1001],[400,453,506,585,641,729,787,846,864,920,975,981,1034],[412,466,521,603,661,752,813,874,892,950,1007,1013,1067]] },
  "LUXURY DUAL OPAQUE": { mult:0.55, W:[91,106,121,137,152,167,182,198,213,228,243,259,274], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], T:[[287.5,320.83,354.2,399.05,433.55,480.7,515.5,554.3,575,610.65,646.3,663.55,698.05],[299,335.8,372.6,419.75,457.7,508.3,547.4,586.5,607.2,645.15,683.1,699.2,736],[312.8,350.75,389.85,440.45,480.7,535.9,577.3,618.7,639.4,679.65,719.9,734.85,773.95],[326.6,366.85,407.1,462.3,503.7,563.5,607.2,650.9,671.6,714.15,755.55,770.5,810.75],[339.25,381.8,424.35,483,526.7,591.1,637.1,683.1,703.8,748.65,792.35,806.15,848.7],[353.05,397.9,441.6,503.7,550.85,618.7,667,715.3,736,783.15,829.15,842.95,886.65],[366.85,412.85,458.85,525.55,573.85,646.3,696.9,747.5,768.2,816.5,865.95,878.6,924.6],[379.5,428.95,477.25,546.25,596.85,672.75,726.8,779.7,800.4,851,902.75,914.25,962.55],[393.3,443.9,494.5,566.95,621,700.35,756.7,811.9,832.6,885.5,938.4,949.9,1000.5],[405.95,458.85,511.75,587.65,644,727.95,786.6,844.1,864.8,920,975.2,985.55,1038.45],[419.75,474.95,529,609.5,667,755.55,815.35,876.3,897,954.5,1012,1021.2,1076.4],[433.55,489.9,546.25,630.2,690,783.15,845.25,908.5,929.2,989,1048.8,1056.85,1114.35],[446.2,504.85,563.5,650.9,713,810.75,875.15,940.7,961.4,1023.5,1085.6,1092.5,1151.15],[460,520.95,581.9,672.75,737.15,838.35,905.05,972.9,993.6,1058,1121.25,1128.15,1189.1],[437.8,535.9,599.15,693.45,760.15,864.8,934.95,1005.1,1025.8,1092.5,1158.05,1164.95,1227.05]] },
  "SHANGRI-LA": { mult:0.55, W:[91,106,121,137,152,167,182,198,213,228,243,259], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], T:[[277.2,324,375.6,435.6,469.6,510,535.8,572.4,590.4,608.4,644.4,680.4],[294,345.6,402,468,504,548.4,610.2,614.4,632.4,649.2,688.8,727.2],[310.8,366,428.4,500.4,538.8,586.8,610.8,656.4,674.4,690,732,774],[327.6,387.6,453.6,532.8,573.6,624,649.2,698.4,715.2,732,775.4,820.8],[344.4,408,480,564,608.4,662.4,687.6,739.2,757.8,772.8,819.6,866.4],[361.2,429.6,505.2,596.4,643.2,700.8,726,781.2,799.2,813.6,864,913.2],[376.8,450,531.6,628.8,676.8,738.4,764.4,823.2,841.2,854.4,907.2,960],[393.6,471.6,556.8,661.21,711.6,776.4,804,865.2,882,896.4,951.6,1006.8],[410.4,492,583.2,693.6,746.4,814.8,842.4,907.2,924,937.2,994.8,1053.6],[427.2,513.6,608.4,726,781.2,853.2,880.8,949.2,966,978,1039.2,1099.2],[444,534,634.8,758.4,816,890.4,916.2,990,1008,1020,1082.4,1146],[460.8,555.6,661.26,790.8,850.8,928.8,957.6,1032,1050,1060.8,1126.8,1192.8],[477.6,576.6,686.4,823.2,884.4,967.2,997.2,1074,1090.8,1101.6,1170,1239.6],[494.4,597.6,712.8,854.4,919.2,1004.4,1035.6,1116,1132.8,1142.4,1214.4,1286.4],[511.2,618,738,886.8,954,1042.8,1074,1158,1174.8,1184.4,1257.6,1332]] },
  "PREMIUM SCREEN": { mult:0.50, W:[60,76,91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304,320,335,350,365,381,396,411,426,441,457,472,487,502,518,533,548,563,579,594,609,624,640,655,670,685,701,716,731,746,762], T:[[97,113,116,132,156,160,165,196,212,248,259,276,293,311,329,346,364],[101,118,120,144,165,172,184,207,224,259,271,288,301,318,336,354,372],[104,123,125,156,172,184,196,219,243,271,283,290,317,335,354,373,391],[108,127,130,167,182,196,207,231,255,283,297,302,332,351,370,390,409],[111,132,134,179,193,207,219,243,266,295,309,314,346,366,386,406,426],[113,134,139,191,205,219,231,255,278,307,321,349,368,389,411,432,454],[118,139,144,203,217,231,243,266,290,318,335,361,383,405,427,449,472],[123,144,149,215,229,243,255,278,302,330,347,373,397,420,442,465,488],[125,149,153,226,240,255,266,290,314,342,358,384,411,435,458,482,505],[130,156,160,238,252,266,278,302,325,361,375,398,429,453,477,502,526],[156,184,189,250,264,278,290,314,337,373,387,413,438,462,486,509,533],[158,189,193,262,276,290,321,325,349,384,398,427,456,480,505,529,554],[163,191,198,273,283,302,314,337,361,396,410,442,469,494,519,544,569],[165,196,203,285,292,314,325,349,373,408,422,456,484,510,536,562,588],[189,217,222,297,309,325,337,361,384,420,434,470,495,520,546,572,597],[191,219,226,309,318,337,349,373,396,431,446,485,510,537,563,589,616],[196,224,231,321,335,349,361,384,408,443,457,499,525,552,579,607,634],[198,229,243,332,342,361,373,396,420,455,469,514,540,568,596,623,651],[203,233,248,344,358,373,384,408,431,467,481,528,555,584,612,641,669],[212,252,257,356,370,384,396,420,443,479,493,542,568,597,626,654,683],[215,257,269,368,382,396,408,431,455,490,505,557,583,613,642,671,701],[219,259,273,380,396,408,420,443,467,502,516,571,599,629,659,689,719],[222,266,281,391,410,420,431,455,479,514,528,586,614,644,675,706,736],[226,271,285,403,420,431,443,467,490,526,540,600,628,660,691,723,754],[235,281,297,415,434,443,455,479,502,538,552,615,642,674,706,738,770],[240,289,305,427,446,455,467,490,514,549,563,629,657,689,722,754,787],[245,296,313,439,459,467,479,502,526,561,575,643,672,705,718,770,804],[250,303,321,450,472,479,490,514,538,573,587,658,686,720,753,787,820],[255,310,329,462,485,490,502,526,549,585,599,672,701,735,769,803,837],[261,317,337,474,497,502,514,538,561,597,611,687,716,750,785,820,854],[266,324,345,486,510,514,526,549,573,608,622,701,730,765,801,836,871],[271,331,353,497,523,526,538,561,585,620,634,716,745,781,817,852,888],[276,338,361,509,535,538,549,573,597,632,646,730,769,796,832,869,905],[282,346,369,521,548,549,561,585,608,644,658,744,774,811,848,885,922],[287,353,377,533,561,569,573,597,620,655,670,759,789,826,864,902,939],[292,360,385,545,574,573,585,608,632,667,681,773,803,841,880,918,956],[297,367,393,556,580,585,597,620,644,679,693,788,818,857,895,934,973],[303,374,401,568,590,597,608,632,655,691,705,802,832,872,911,951,990],[308,381,409,580,608,612,620,644,667,703,717,816,847,887,937,967,1007],[313,388,417,592,620,624,632,655,679,714,729,831,862,902,943,983,1024],[318,396,425,604,632,637,644,667,691,726,740,845,876,917,959,1000,1041],[323,403,433,615,644,650,655,679,703,738,752,860,891,933,974,1016,1058],[329,410,441,627,655,663,667,691,714,750,764,874,906,948,990,1032,1070],[334,417,449,639,667,675,679,703,726,762,776,889,920,963,1006,1049,1092],[339,424,457,651,679,688,691,714,738,773,787,903,932,978,1022,1055,1109]] },
  "PREMIUM BLACKOUT": { mult:0.51, W:[60,76,91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304,320,335,350,365,381,396,411,426,441,457,472,487,502,518,533,548,563,579,594,609,624,640,655,670,685,701,716,731,746,762], T:[[97,113,116,132,156,160,165,196,212,248,259,276,293,311,329,346,364],[101,118,120,144,165,172,184,207,224,259,271,288,301,318,336,354,372],[104,123,125,156,172,184,196,219,243,271,283,290,317,335,354,373,391],[108,127,130,167,182,196,207,231,255,283,297,302,332,351,370,390,409],[111,132,134,179,193,207,219,243,266,295,309,314,346,366,386,406,426],[113,134,139,191,205,219,231,255,278,307,321,349,368,389,411,432,454],[118,139,144,203,217,231,243,266,290,318,335,361,383,405,427,449,472],[123,144,149,215,229,243,255,278,302,330,347,373,397,420,442,465,488],[125,149,153,226,240,255,266,290,314,342,358,384,411,435,458,482,505],[130,156,160,238,252,266,278,302,325,361,375,398,429,453,477,502,526],[156,184,189,250,264,278,290,314,337,373,387,413,438,462,486,509,533],[158,189,193,262,276,290,321,325,349,384,398,427,456,480,505,529,554],[163,191,198,273,283,302,314,337,361,396,410,442,469,494,519,544,569],[165,196,203,285,292,314,325,349,373,408,422,456,484,510,536,562,588],[189,217,222,297,309,325,337,361,384,420,434,470,495,520,546,572,597],[191,219,226,309,318,337,349,373,396,431,446,485,510,537,563,589,616],[196,224,231,321,335,349,361,384,408,443,457,499,525,552,579,607,634],[198,229,243,332,342,361,373,396,420,455,469,514,540,568,596,623,651],[203,233,248,344,358,373,384,408,431,467,481,528,555,584,612,641,669],[212,252,257,356,370,384,396,420,443,479,493,542,568,597,626,654,683],[215,257,269,368,382,396,408,431,455,490,505,557,583,613,642,671,701],[219,259,273,380,396,408,420,443,467,502,516,571,599,629,659,689,719],[222,266,281,391,410,420,431,455,479,514,528,586,614,644,675,706,736],[226,271,285,403,420,431,443,467,490,526,540,600,628,660,691,723,754],[235,281,297,415,434,443,455,479,502,538,552,615,642,674,706,738,770],[240,289,305,427,446,455,467,490,514,549,563,629,657,689,722,754,787],[245,296,313,439,459,467,479,502,526,561,575,643,672,705,718,770,804],[250,303,321,450,472,479,490,514,538,573,587,658,686,720,753,787,820],[255,310,329,462,485,490,502,526,549,585,599,672,701,735,769,803,837],[261,317,337,474,497,502,514,538,561,597,611,687,716,750,785,820,854],[266,324,345,486,510,514,526,549,573,608,622,701,730,765,801,836,871],[271,331,353,497,523,526,538,561,585,620,634,716,745,781,817,852,888],[276,338,361,509,535,538,549,573,597,632,646,730,769,796,832,869,905],[282,346,369,521,548,549,561,585,608,644,658,744,774,811,848,885,922],[287,353,377,533,561,569,573,597,620,655,670,759,789,826,864,902,939],[292,360,385,545,574,573,585,608,632,667,681,773,803,841,880,918,956],[297,367,393,556,580,585,597,620,644,679,693,788,818,857,895,934,973],[303,374,401,568,590,597,608,632,655,691,705,802,832,872,911,951,990],[308,381,409,580,608,612,620,644,667,703,717,816,847,887,937,967,1007],[313,388,417,592,620,624,632,655,679,714,729,831,862,902,943,983,1024],[318,396,425,604,632,637,644,667,691,726,740,845,876,917,959,1000,1041],[323,403,433,615,644,650,655,679,703,738,752,860,891,933,974,1016,1058],[329,410,441,627,655,663,667,691,714,750,764,874,906,948,990,1032,1070],[334,417,449,639,667,675,679,703,726,762,776,889,920,963,1006,1049,1092],[339,424,457,651,679,688,691,714,738,773,787,903,932,978,1022,1055,1109]] },
  "LUXURY ROLLERS": { mult:0.55, W:[60,76,91,106,121,137,152,167,182,198,213,228,243,259,274,289,304], H:[91,106,121,137,152,167,182,198,213,228,243,259,274,289,304,320,335,350,365,381,396,411,426,441,457,472,487,502,518,533,548,563,579,594,609,624,640,655,670,685,701,716,731,746,762], T:[[131,153,157,178,211,216,223,265,286,335,350,389,396,420,444,467,491],[136,159,162,194,223,232,248,279,302,350,366,373,406,429,454,478,502],[140,166,169,211,232,248,265,296,328,366,382,392,428,452,478,504,528],[146,171,176,225,246,265,279,312,344,382,401,408,448,474,500,527,552],[150,178,181,242,261,279,296,328,359,398,417,424,467,494,521,548,575],[153,181,188,258,277,296,312,344,375,414,433,471,497,525,555,583,613],[159,188,194,274,293,312,328,359,392,429,452,487,517,547,576,606,637],[166,194,201,290,309,328,344,375,408,446,468,504,536,567,597,628,659],[169,201,207,305,324,344,359,392,424,462,483,518,555,587,618,651,682],[176,211,216,321,340,359,375,408,439,487,506,537,579,612,644,678,710],[211,248,255,338,356,375,392,424,455,504,522,558,591,624,656,687,720],[213,255,261,354,373,392,433,439,471,518,537,576,616,648,682,714,748],[220,258,267,369,382,408,424,455,487,535,554,597,633,667,701,734,768],[223,265,274,385,392,424,439,471,504,551,570,616,653,689,724,759,794],[255,293,300,401,417,439,455,487,518,567,586,635,668,707,737,772,806],[258,296,305,417,429,455,471,504,535,582,602,655,689,725,760,795,832],[265,302,312,433,452,471,487,518,551,598,617,674,709,745,782,819,856],[267,309,328,448,462,487,504,535,567,614,633,694,729,767,805,841,879],[274,315,335,464,483,504,518,551,582,630,649,713,749,788,826,865,903],[286,340,347,481,500,518,535,567,598,647,666,732,767,806,845,883,922],[290,347,363,497,516,535,551,582,614,662,682,752,787,828,867,906,946],[296,350,369,513,535,551,567,598,630,678,697,771,809,849,890,930,971],[300,359,379,528,554,567,582,614,647,694,713,791,829,869,911,953,994],[305,366,385,544,567,582,598,630,662,710,729,810,848,891,933,976,1018],[317,379,401,560,586,598,614,647,678,726,745,830,867,910,953,996,1040],[324,390,412,576,602,614,630,662,694,741,760,849,887,930,975,1018,1062],[331,400,423,593,620,630,647,678,710,757,776,868,907,952,996,1041,1085],[338,409,433,608,637,647,662,694,726,774,792,888,926,972,1017,1062,1107],[344,419,444,624,655,662,678,710,741,790,809,907,946,992,1038,1084,1130],[352,428,455,640,671,678,694,726,757,806,825,927,967,1013,1060,1107,1153],[359,337,466,656,689,694,710,741,774,821,840,946,986,1033,1081,1129,1176],[366,447,477,671,706,710,726,757,790,837,856,967,1006,1054,1103,1150,1199],[373,456,487,687,722,726,741,774,806,853,872,986,1025,1075,1123,1173,1222],[381,467,498,703,740,741,757,790,821,869,888,1004,1045,1095,1145,1195,1245],[387,477,509,720,757,767,774,806,837,884,905,1025,1065,1115,1166,1218,1268],[394,486,520,736,775,783,790,821,853,900,919,1044,1084,1135,1188,1239,1291],[401,495,531,751,783,790,806,837,869,917,936,1064,1104,1157,1208,1261,1314],[409,505,541,767,797,806,821,853,884,933,952,1083,1123,1177,1230,1284,1337],[416,514,552,783,821,826,837,869,900,949,968,1102,1143,1197,1251,1305,1359],[423,524,563,799,837,842,853,884,917,964,984,1122,1164,1218,1273,1327,1382],[429,535,574,815,853,860,869,900,933,980,999,1141,1183,1238,1295,1350,1405],[436,544,585,830,869,878,884,917,949,996,1015,1161,1203,1260,1315,1372,1428],[444,554,595,846,884,895,900,933,964,1013,1031,1180,1223,1280,1337,1393,1351],[451,563,606,863,900,911,917,949,980,1029,1048,1200,1242,1300,1358,1416,1474],[458,572,617,879,917,929,933,964,996,1044,1062,1219,1262,1320,1380,1438,1497]] },
};


function getProductImage(p, telas) {
  if (p.tipoProducto === "PERSIANA") {
    return PRODUCT_IMAGES[p.tipoPersiana] || null;
  } else if (p.tipoProducto === "TOLDO VERTICAL") {
    return PRODUCT_IMAGES["TOLDO VERTICAL"] || null;
  } else if (p.tipoProducto === "PÉRGOLA BRAZO EXTENSIBLE") {
    return PRODUCT_IMAGES["PÉRGOLA BRAZO EXTENSIBLE"] || null;
  } else {
    const tela = telas ? telas.find(function(t){ return t.id === p.telaId; }) : null;
    if (!tela) return null;
    const n = tela.nombre.toLowerCase();
    if (n.includes("blackout")) return PRODUCT_IMAGES["CORTINA_BLACKOUT"];
    if (n.includes("velo") || n.includes("stock")) return PRODUCT_IMAGES["CORTINA_VELO"];
    return PRODUCT_IMAGES["CORTINA_BLACKOUT"];
  }
}

function getExtraImage(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes("andamio")) return PRODUCT_IMAGES["ANDAMIO"];
  if (n.includes("casette") || n.includes("cassette")) return PRODUCT_IMAGES["CENEFA_CASETTE"];
  if (n.includes("pvc")) return PRODUCT_IMAGES["CENEFA_PVC"];
  if (n.includes("cenefa") && !n.includes("pvc") && !n.includes("casette")) return PRODUCT_IMAGES["CENEFA_PVC"];
  if (n.includes("somfy")) return PRODUCT_IMAGES["CONTROL_SOMFY"];
  if (n.includes("control") || n.includes("mando")) return PRODUCT_IMAGES["CONTROL_TBC"];
  return null;
}
function lookupPrice(tipo,w,h){const t=TABLES[tipo];if(!t)return null;const wi=t.W.findIndex(v=>v>=w);const hi=t.H.findIndex(v=>v>=h);return t.T[hi<0?t.H.length-1:hi]?.[wi<0?t.W.length-1:wi]??null;}
const DEFAULT_TELAS=[{id:"t1",nombre:"Tela Blackout Stock",precio:25,unidad:"Yarda Doble"},{id:"t2",nombre:"Tela Velo Stock",precio:20,unidad:"Yarda Doble"}];
const DEFAULT_CONFECCIONES=[{id:"c1",nombre:"RIPPLEFOLD",divisor:20},{id:"c2",nombre:"PETERSON",divisor:20},{id:"c3",nombre:"AMERICANO",divisor:25},{id:"c4",nombre:"REBBECA",divisor:16},{id:"c5",nombre:"INVERSO",divisor:20}];
const RIELES=[{id:"r1",nombre:"Riel Hotelero",precio:55,unidad:"Metro Lineal"},{id:"r2",nombre:"Riel Ripplefold",precio:60,unidad:"Metro Lineal"},{id:"r3",nombre:"Riel Motorizado TBC (hasta 4m)",precio:519,unidad:"Unidad"},{id:"r4",nombre:"Riel Motorizado TBC (4-5m)",precio:605,unidad:"Unidad"},{id:"r5",nombre:"Riel Motorizado Celtic (1-5m)",precio:900,unidad:"Unidad"},{id:"r6",nombre:"Riel Motorizado Somfy (1-5m)",precio:1300,unidad:"Unidad"}];
const CORTINA_CONTROLES=[{id:"cc1",nombre:"Control Unicanal TBC",precio:35},{id:"cc2",nombre:"Control Multicanal TBC (5)",precio:50},{id:"cc3",nombre:"Control Unicanal Celtic",precio:40},{id:"cc4",nombre:"Control Multicanal Celtic (5)",precio:70},{id:"cc5",nombre:"Control Unicanal Somfy",precio:99},{id:"cc6",nombre:"Control Multicanal Somfy",precio:139}];
const MOTORES=[{id:"m1",nombre:"Motor TBC 1L",precio:170},{id:"m2",nombre:"Motor TBC 2L",precio:262},{id:"m3",nombre:"Motor TBC 3L",precio:437},{id:"m4",nombre:"Motor TBC 1L WIFI",precio:210},{id:"m5",nombre:"Motor TBC 2L WIFI",precio:310},{id:"m6",nombre:"Motor TBC 3L WIFI",precio:510},{id:"m7",nombre:"Motor Somfy 1L",precio:342},{id:"m8",nombre:"Motor Somfy 2L",precio:437},{id:"m9",nombre:"Motor Somfy 3L",precio:700},{id:"m10",nombre:"Motor TBC Batería (1)",precio:193},{id:"m11",nombre:"Motor TBC Batería (2)",precio:245},{id:"m12",nombre:"Motor TBC Batería (3)",precio:263}];
const PERSIANA_CONTROLES=[{id:"pc1",nombre:"Control Unicanal TBC",precio:35},{id:"pc2",nombre:"Control Multicanal TBC",precio:50},{id:"pc3",nombre:"Control Unicanal Somfy",precio:99},{id:"pc4",nombre:"Control Multicanal Somfy",precio:139}];

// ─── TOLDO VERTICAL & PÉRGOLA TABLES ─────────────────────────────────────────
const TOLDO_VERTICAL = {
  mult: 0.70,
  // Widths in meters (user inputs cm, we convert)
  W: [1.25,1.50,1.75,2.00,2.25,2.50,2.75,3.00,3.25,3.50,3.75,4.00,4.25,4.50,4.75,5.00],
  H: [1.75,2.00,2.25,2.50,2.75,3.00,3.25,3.50,3.75,4.00,4.25,4.50,4.75,5.00],
  T: [
    [784,815,848,882,917,954,992,1032,1073,1116,1161,1207,1255,1305,1358,1412],
    [808,840,873,908,945,982,1022,1063,1105,1149,1195,1243,1293,1345,1398,1454],
    [832,865,900,936,973,1012,1052,1095,1138,1184,1231,1280,1332,1385,1440,1498],
    [857,891,927,964,1002,1042,1084,1127,1172,1219,1268,1319,1372,1426,1484,1543],
    [882,918,954,993,1032,1074,1117,1161,1208,1256,1306,1358,1413,1469,1528,1589],
    [909,945,983,1022,1063,1106,1150,1196,1244,1294,1345,1399,1455,1513,1574,1637],
    [936,974,1013,1053,1095,1139,1185,1232,1281,1332,1386,1441,1499,1559,1621,1686],
    [964,1003,1043,1085,1128,1173,1220,1269,1320,1372,1427,1484,1544,1605,1670,1737],
    [993,1033,1074,1117,1162,1208,1257,1307,1359,1414,1470,1529,1590,1654,1720,1789],
    [1023,1064,1106,1151,1197,1245,1294,1346,1400,1456,1514,1575,1638,1703,1771,1842],
    [1054,1096,1140,1185,1233,1282,1333,1387,1442,1500,1560,1622,1687,1754,1825,1898],
    [1085,1129,1174,1221,1270,1320,1373,1428,1485,1545,1606,1671,1738,1807,1879,1954],
    [1118,1163,1209,1257,1308,1360,1414,1471,1530,1591,1655,1721,1790,1861,1936,2013],
    [1151,1197,1245,1295,1347,1401,1457,1515,1576,1639,1704,1772,1843,1917,1994,2073],
  ]
};

const PERGOLA_BRAZO = {
  mult: 0.70,
  W: [2.00,2.25,2.50,2.75,3.00,3.25,3.50,3.75,4.00,4.25,4.50,4.75,5.00,5.25,5.50,5.75],
  H: [1.50,2.00,2.50,3.00,3.50],
  // null = combinacion no disponible
  T: [
    [1750,1838,1911,1987,2067,2150,2236,2325,2418,2515,2615,2720,2829,2942,3060,3182],
    [null,null,2007,2087,2170,2257,2347,2441,2539,2640,2746,2856,2970,3089,3213,3341],
    [null,null,null,2191,2279,2370,2465,2563,2666,2773,2883,2999,3119,3243,3373,3508],
    [null,null,null,null,2488,2588,2692,2799,2911,3028,3149,3275,3406,3542,3684,null],
    [null,null,null,null,null,null,null,null,2939,3057,3179,3306,3438,3576,3719,3868],
  ]
};

const MOTORES_TOLDO = [
  {id:"mt1", nombre:"Motor Toldo Vertical 30Nm", precio:266},
  {id:"mt2", nombre:"Motor Toldo Vertical 50Nm", precio:326},
];
const MOTORES_PERGOLA = [
  {id:"mp1", nombre:"Motor Pérgola 30Nm", precio:266},
  {id:"mp2", nombre:"Motor Pérgola 50Nm", precio:326},
];
const CONTROLES_TOLDO = [
  {id:"ct1", nombre:"Control Unicanal TBC", precio:35},
  {id:"ct2", nombre:"Control Multicanal TBC", precio:50},
];
const INST_TOLDO_MANUAL=150, INST_TOLDO_MOTOR=175;

function lookupToldo(tabla, anchoM, altoM) {
  const wi = tabla.W.findIndex(function(v){return v>=anchoM;});
  const hi = tabla.H.findIndex(function(v){return v>=altoM;});
  const wIdx = wi < 0 ? tabla.W.length-1 : wi;
  const hIdx = hi < 0 ? tabla.H.length-1 : hi;
  return tabla.T[hIdx]?.[wIdx] ?? null;
}

function getRangeToldo(tabla) {
  const allW = tabla.W, allH = tabla.H;
  return {
    minW: allW[0]*100, maxW: allW[allW.length-1]*100,
    minH: allH[0]*100, maxH: allH[allH.length-1]*100
  };
}

function calcToldoTotal(p) {
  const tabla = p.tipoProducto==="TOLDO VERTICAL" ? TOLDO_VERTICAL : PERGOLA_BRAZO;
  if(!p.ancho||!p.alto) return null;
  const anchoM = parseFloat(p.ancho)/100;
  const altoM = parseFloat(p.alto)/100;
  const range = getRangeToldo(tabla);
  if(parseFloat(p.ancho)<range.minW||parseFloat(p.ancho)>range.maxW) return null;
  if(parseFloat(p.alto)<range.minH||parseFloat(p.alto)>range.maxH) return null;
  const base = lookupToldo(tabla, anchoM, altoM);
  if(base===null) return {noDisponible:true};
  const defaultMult = tabla.mult;
  const mult = p.mult!==null&&p.mult!==undefined ? parseFloat(p.mult)||defaultMult : defaultMult;
  const ajustadoCalculado = base*mult;
  const ajustado = p.precioAjustadoManual!==null&&p.precioAjustadoManual!==undefined ? parseFloat(p.precioAjustadoManual) : ajustadoCalculado;
  const motorizado = p.tipoAccionamiento==="MOTORIZADA";
  const instBase = motorizado ? INST_TOLDO_MOTOR : INST_TOLDO_MANUAL;
  const instPrecio = p.incluyeInstalacion ? (p.instalacionPrecio??instBase) : 0;
  const motores = p.tipoProducto==="TOLDO VERTICAL" ? MOTORES_TOLDO : MOTORES_PERGOLA;
  const motorObj = [...motores,...(p._motoresCustom||[])].find(function(m){return m.id===p.motorId;});
  const motorPrecio = motorObj?.precio||0;
  const controlObj = [...CONTROLES_TOLDO,...(p._controlesCustom||[])].find(function(ct){return ct.id===p.controlId;});
  const controlPrecio = controlObj?.precio||0;
  const cantidad = parseInt(p.cantidad)||1;
  const subtotal = ajustado+instPrecio+motorPrecio+controlPrecio;
  const total = subtotal*cantidad;
  const altoDoble = parseFloat(p.alto)>350;
  return {base,mult,defaultMult,ajustadoCalculado,ajustado,instBase,instPrecio,motorPrecio,controlPrecio,subtotal,cantidad,total,altoDoble,noDisponible:false};
}

const CENEFAS=[{id:"cn1",nombre:"Cenefa PVC",precio:30},{id:"cn2",nombre:"Cenefa Casette",precio:35}];
const INST_ROLLER_MANUAL=25,INST_ROLLER_MANUAL_DBL=50,INST_ROLLER_MOTOR=50,INST_ROLLER_MOTOR_DBL=100,INST_PERFILES=40,INST_CENEFA=10;
const INST_CORTINA_MANUAL=50,INST_CORTINA_MANUAL_DBL=100,INST_CORTINA_MOTOR=100,INST_CORTINA_MOTOR_DBL=200;

const VIVENDI_LOGO_IMG = "https://res.cloudinary.com/dthqt2tph/image/upload/Vivendi_Black_1_tivib2";

const VivendiLogo = () => (
  <img src={VIVENDI_LOGO_IMG} style={{height:52, width:"auto", mixBlendMode:"multiply"}}/>
);

// ─── TBC SVG LOGO ─────────────────────────────────────────────────────────────
const TBCLogo = () => (
  <svg width="220" height="80" viewBox="0 0 440 158" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer rectangle */}
    <rect x="2" y="2" width="116" height="154" rx="1.5" stroke="#111" strokeWidth="3.5" fill="none"/>
    {/* 3 vertical dividers creating 4 columns: narrow|narrow|narrow|wide */}
    <line x1="30" y1="2" x2="30" y2="156" stroke="#111" strokeWidth="3"/>
    <line x1="52" y1="2" x2="52" y2="156" stroke="#111" strokeWidth="3"/>
    <line x1="74" y1="2" x2="74" y2="156" stroke="#111" strokeWidth="3"/>
    {/* Horizontal slats — ONLY inside the right wide column (x: 74 to 118) */}
    <line x1="74" y1="28" x2="118" y2="28" stroke="#111" strokeWidth="2.5"/>
    <line x1="74" y1="48" x2="118" y2="48" stroke="#111" strokeWidth="2.5"/>
    <line x1="74" y1="68" x2="118" y2="68" stroke="#111" strokeWidth="2.5"/>
    <line x1="74" y1="88" x2="118" y2="88" stroke="#111" strokeWidth="2.5"/>
    <line x1="74" y1="108" x2="118" y2="108" stroke="#111" strokeWidth="2.5"/>
    <line x1="74" y1="128" x2="118" y2="128" stroke="#111" strokeWidth="2.5"/>
    {/* Text */}
    <text x="138" y="52" fontFamily="Georgia, 'Times New Roman', serif" fontSize="48" fontWeight="400" fill="#111">The</text>
    <text x="138" y="106" fontFamily="Georgia, 'Times New Roman', serif" fontSize="48" fontWeight="400" fill="#111">Blind</text>
    <text x="138" y="154" fontFamily="Georgia, 'Times New Roman', serif" fontSize="48" fontWeight="400" fill="#111">Concept</text>
  </svg>
);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const C={gold:"#B8965A",goldL:"#C8A46A",dark:"#0A0A0A",dark2:"#111111",dark3:"#181818",border:"#222222",text:"#F0EDE8",muted:"#666",green:"#4CAF7D",red:"#E05555"};
const S={
  wrap:{fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif",background:"#0A0A0A",minHeight:"100vh",paddingBottom:80,color:C.text},
  header:{background:"#ffffff",borderBottom:"1px solid #f0f0f0",padding:"20px 40px",display:"flex",alignItems:"center",gap:20},
  page:{maxWidth:820,margin:"0 auto",padding:"32px 20px 0"},
  card:{background:"#111",border:"1px solid #1e1e1e",borderRadius:16,padding:"28px 32px",marginBottom:16},
  sectionLabel:{fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",color:C.gold,marginBottom:20,display:"flex",alignItems:"center",gap:8},
  g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
  g3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12},
  field:{display:"flex",flexDirection:"column",gap:6},
  lbl:{fontSize:10,fontWeight:600,color:"#555",letterSpacing:0.8,textTransform:"uppercase"},
  inp:{background:"#0A0A0A",border:"1px solid #222",borderRadius:10,padding:"11px 14px",color:C.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color .2s"},
  sel:{background:"#0A0A0A",border:"1px solid #222",borderRadius:10,padding:"11px 14px",color:C.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",appearance:"none",transition:"border-color .2s"},
  radioRow:{display:"flex",gap:6,flexWrap:"wrap"},
  radio:(a)=>({padding:"8px 16px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${a?C.gold:"#2a2a2a"}`,background:a?"rgba(184,150,90,.12)":"transparent",color:a?C.goldL:"#aaa",transition:"all .2s",letterSpacing:0.3}),
  divider:{height:1,background:"#1a1a1a",margin:"20px 0"},
  priceBox:{background:"rgba(184,150,90,.06)",border:"1px solid rgba(184,150,90,.15)",borderRadius:12,padding:"16px 20px",marginTop:16},
  priceRow:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555",marginBottom:6},
  totalRow:{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,color:C.goldL,borderTop:"1px solid rgba(184,150,90,.15)",paddingTop:10,marginTop:6},
  addBtn:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"transparent",border:"1px dashed #2a2a2a",borderRadius:12,padding:"12px 20px",color:"#aaa",fontSize:12,fontWeight:600,cursor:"pointer",width:"100%",marginTop:10,transition:"all .2s"},
  pieceAddBtn:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"transparent",border:"1px solid #222",borderRadius:14,padding:"16px 20px",color:"#aaa",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",marginTop:6,transition:"all .2s"},
  removeBtn:{background:"transparent",border:"1px solid #2a2a2a",borderRadius:8,padding:"4px 12px",color:"#aaa",fontSize:11,cursor:"pointer",fontWeight:500,transition:"all .2s"},
  genBtn:{width:"100%",padding:18,background:C.gold,border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:20,letterSpacing:0.5},
  tip:{fontSize:10,color:"#888",marginTop:3},
  badge:(c)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:600,background:`${c}18`,color:c,border:`1px solid ${c}30`}),
  infoRow:{background:"rgba(76,175,125,.05)",border:"1px solid rgba(76,175,125,.12)",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#4CAF7D",marginTop:10},
  tableBox:{overflowX:"auto",borderRadius:10,border:"1px solid #1e1e1e",marginBottom:14},
  table:{width:"100%",borderCollapse:"collapse",fontSize:12},
  th:{background:"#0A0A0A",color:"#aaa",fontWeight:600,padding:"10px 14px",textAlign:"left",fontSize:10,whiteSpace:"nowrap",letterSpacing:0.8,textTransform:"uppercase"},
  td:{padding:"8px 14px",borderBottom:"1px solid #1a1a1a",color:C.text},
  chk:{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 0"},
};

const fmt=(n)=>`$${Number(n||0).toFixed(2)}`;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const extrasTotal=(extras)=>(extras||[]).reduce((s,e)=>s+(parseFloat(e.precio)||0)*(e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1)),0);

// Inyecta keyframe de pulso global una sola vez
(function injectPulseStyle(){
  if(document.getElementById("tbc-pulse-style"))return;
  const el=document.createElement("style");
  el.id="tbc-pulse-style";
  el.textContent="@keyframes tbcPulse{0%,100%{box-shadow:0 0 0 0 rgba(184,150,90,0.6);}50%{box-shadow:0 0 0 7px rgba(184,150,90,0);}}";
  document.head.appendChild(el);
})();

// ─── CALC FUNCTIONS ────────────────────────────────────────────────────────────
function calcCortinaTotal(p,telas,confecciones,rielesCustom){
  const conf=confecciones.find(c=>c.id===p.confeccionId);
  const divisor=conf?.divisor||20;
  const anchoIn=(p.ancho||0)*0.3937,altoIn=(p.alto||0)*0.3937;
  const panos=Math.ceil((anchoIn+(p.dosVias?10:0))/divisor);
  const yardasDobles=Math.ceil(Math.ceil(panos*((altoIn+12)/36))/2);
  const telaObj=telas.find(t=>t.id===p.telaId);
  const todosRieles=[...RIELES,...(rielesCustom||[])];
  const rielObj=todosRieles.find(r=>r.id===p.rielId);
  const rielPrecio=rielObj?(rielObj.unidad==="Metro Lineal"?rielObj.precio*((p.ancho||0)/100):rielObj.precio):0;
  const altoDoble=(p.alto||0)>350,motorizado=p.tipoAccionamiento==="MOTORIZADA";
  const instBase=altoDoble?(motorizado?INST_CORTINA_MOTOR_DBL:INST_CORTINA_MANUAL_DBL):(motorizado?INST_CORTINA_MOTOR:INST_CORTINA_MANUAL);
  const anchoDobleRiel=(p.ancho||0)>280;
  const instMultiplier=anchoDobleRiel?2:1;
  const instPrecio=p.incluyeInstalacion?(p.instalacionPrecio??instBase)*instMultiplier:0;
  const confPrecioUnit=altoDoble?48:24;
  const confeccionPrecioUnit=p.confeccionPrecioUnit??confPrecioUnit;
  const confeccionPrecio=confeccionPrecioUnit*panos;
  const telaPrecio=(telaObj?.precio||0)*yardasDobles;
  const vapPrecio=p.vaporizacion?16:0,bastaPrecio=p.basta?60:0;
  const controlObj=[...CORTINA_CONTROLES,...(p._controlesCustom||[])].find(c=>c.id===p.controlId);
  const controlPrecio=controlObj?.precio||0;
  const andamioPrecio=p.andamio?150:0;
  const total=confeccionPrecio+telaPrecio+rielPrecio+instPrecio+vapPrecio+bastaPrecio+controlPrecio+andamioPrecio;
  return{panos,yardasDobles,confeccionPrecio,confeccionPrecioUnit:confeccionPrecioUnit,telaPrecio,rielPrecio,instPrecio,instBase,instMultiplier,anchoDobleRiel,altoDoble,vapPrecio,bastaPrecio,controlPrecio,andamioPrecio,total};
}

function getRange(tipo){const t=TABLES[tipo];if(!t)return null;return{minW:t.W[0],maxW:t.W[t.W.length-1],minH:t.H[0],maxH:t.H[t.H.length-1]};}
function validateDims(tipo,ancho,alto){if(!tipo)return{wErr:null,hErr:null};const r=getRange(tipo);if(!r)return{wErr:null,hErr:null};const w=parseFloat(ancho),h=parseFloat(alto);return{wErr:!isNaN(w)&&w>r.maxW?`Máx ${r.maxW}cm`:null,hErr:!isNaN(h)&&h>r.maxH?`Máx ${r.maxH}cm`:null};}

function calcPersianaTotal(p){
  const tipo=p.tipoPersiana;
  if(!tipo||!p.ancho||!p.alto)return null;
  const{wErr,hErr}=validateDims(tipo,p.ancho,p.alto);
  if(wErr||hErr)return null;
  const base=lookupPrice(tipo,p.ancho,p.alto);
  if(base===null)return null;
  const defaultMult=TABLES[tipo]?.mult||1,mult=p.mult??defaultMult;
  const ajustadoCalculado=base*mult;
  // Use manual price if set, otherwise use calculated
  const ajustado=p.precioAjustadoManual!==null&&p.precioAjustadoManual!==undefined?parseFloat(p.precioAjustadoManual):ajustadoCalculado;
  const altoDoble=p.alto>350,motorizado=p.tipoAccionamiento==="MOTORIZADA";
  const instBase=altoDoble?(motorizado?INST_ROLLER_MOTOR_DBL:INST_ROLLER_MANUAL_DBL):(motorizado?INST_ROLLER_MOTOR:INST_ROLLER_MANUAL);
  const instPrecio=p.incluyeInstalacion?(p.instalacionPrecio??instBase):0;
  const motorObj=[...MOTORES,...(p._motoresCustom||[])].find(m=>m.id===p.motorId),motorPrecio=motorObj?.precio||0;
  const controlObj=[...PERSIANA_CONTROLES,...(p._controlesCustom||[])].find(c=>c.id===p.controlId),controlPrecio=controlObj?.precio||0;
  const cenefaObj=[...CENEFAS,...(p._cenefasCustom||[])].find(c=>c.id===p.cenefaId);
  const cenefaMLcalc=p.ancho/100;
  const cenefaML=p.cenefa?(p.cenefaMLManual===null||p.cenefaMLManual===undefined?cenefaMLcalc:(p.cenefaMLManual===""?0:parseFloat(p.cenefaMLManual)||0)):0;
  const cenefaPrecio=p.cenefa&&cenefaObj?cenefaML*cenefaObj.precio:0;
  const instCenefaPrecio=p.cenefa?(p.instCenefaPrecio??INST_CENEFA):0;
  const perfilesMLcalc=(p.alto/100)*2;
  const perfilesML=p.perfiles?(p.perfilesMLManual===null||p.perfilesMLManual===undefined?perfilesMLcalc:(p.perfilesMLManual===""?0:parseFloat(p.perfilesMLManual)||0)):0;
  const perfilPrecioUnit=p.perfilPrecioUnit===null||p.perfilPrecioUnit===undefined?30:(p.perfilPrecioUnit===""?0:parseFloat(p.perfilPrecioUnit)||0);
  const perfilesPrecio=p.perfiles?perfilesML*perfilPrecioUnit:0;
  const instPerfilesPrecio=p.perfiles?(p.instPerfilesPrecio??INST_PERFILES):0;
  const cantidad=parseInt(p.cantidad)||1;
  const subtotal=ajustado+instPrecio+motorPrecio+controlPrecio+cenefaPrecio+instCenefaPrecio+perfilesPrecio+instPerfilesPrecio;
  const total=subtotal*cantidad;
  return{base,mult,defaultMult,ajustado,ajustadoCalculado,instBase,instPrecio,motorPrecio,controlPrecio,cenefaML,cenefaPrecio,instCenefaPrecio,perfilesML,perfilesPrecio,instPerfilesPrecio,subtotal,cantidad,total};
}


// ─── PAPEL DE PARED CALCULATIONS ──────────────────────────────────────────────
function calcPapelRollos(p) {
  const paredes = p.papelParedes || [];
  const anchoRollo = parseFloat(p.papelAnchoRollo) || 0;
  const largoRollo = parseFloat(p.papelLargoRollo) || 0;
  const repeticion = parseFloat(p.papelRepeticion) || 0;
  if (!anchoRollo || !largoRollo) return null;
  let totalRollos = 0;
  const detalle = paredes.map(function(pared) {
    const anchoPared = parseFloat(pared.ancho) || 0;
    const altoPared = parseFloat(pared.alto) || 0;
    if (!anchoPared || !altoPared) return { nombre: pared.nombre, rollos: 0, skip: true };
    const altoEfectivo = repeticion > 0 ? altoPared + (repeticion / 2) : altoPared;
    const tirasPared = Math.ceil(anchoPared / anchoRollo);
    const tirasPorRollo = Math.ceil(largoRollo / altoEfectivo);
    const rollosPared = Math.ceil(tirasPared / tirasPorRollo);
    totalRollos += rollosPared;
    return { nombre: pared.nombre, anchoPared, altoPared, altoEfectivo, tirasPared, tirasPorRollo, rollosPared };
  });
  const totalConDesperdicio = Math.ceil(totalRollos * 1.10);
  return { detalle, totalRollos, totalConDesperdicio };
}

function calcPapelYardas(p) {
  const paredes = p.papelParedes || [];
  const anchoRollo = parseFloat(p.papelAnchoRollo) || 0;
  if (!anchoRollo) return null;
  let totalYardas = 0;
  const detalle = paredes.map(function(pared) {
    const anchoPared = parseFloat(pared.ancho) || 0;
    const altoPared = parseFloat(pared.alto) || 0;
    if (!anchoPared || !altoPared) return { nombre: pared.nombre, yardas: 0, skip: true };
    const X = Math.ceil(anchoPared / anchoRollo);
    const A = altoPared * 1.2;
    const yardas = A * X;
    totalYardas += yardas;
    return { nombre: pared.nombre, anchoPared, altoPared, X, A, yardas };
  });
  const totalFinal = Math.ceil(totalYardas);
  return { detalle, totalYardas, totalFinal };
}

function calcPapelTotal(p) {
  const precio = parseFloat(p.papelPrecioUnit) || 0;
  if (!precio) return 0;
  if (!p.papelUsarCalculadora) {
    const cantManual = parseFloat(p.papelCantidadManual) || 0;
    return cantManual * precio;
  }
  if (p.papelModo === "ROLLO") {
    const r = calcPapelRollos(p);
    const cant = r ? r.totalConDesperdicio : 0;
    return cant * precio;
  } else {
    const y = calcPapelYardas(p);
    const cant = y ? y.totalFinal : 0;
    return cant * precio;
  }
}

function calcOtroTotal(p) {
  const precio = parseFloat(p.otroPrecioUnit) || 0;
  const cantidad = parseInt(p.otroCantidad) || 1;
  return precio * cantidad;
}

// Description builder for PDF
function buildDesc(p,telas,confecciones,rielesCustom){
  const parts=[];
  if(p.tipoProducto==="PERSIANA"){
    if(p.tipoPersiana)parts.push(p.tipoPersiana);
    if(p.tipoAccionamiento==="MOTORIZADA"){
      const m=[...MOTORES,...(p._motoresCustom||[])].find(x=>x.id===p.motorId);
      if(m){
        const mName=m.nombre.replace(/^Motor\s+/i,"");
        parts.push("MOTOR "+mName.toUpperCase());
      }
      const ctrl=[...PERSIANA_CONTROLES,...(p._controlesCustom||[])].find(x=>x.id===p.controlId);
      if(ctrl){
        const cName=ctrl.nombre.replace(/^Control\s+/i,"");
        parts.push("CONTROL "+cName.toUpperCase());
      }
    }
    if(p.cenefa){
      const cn=[...CENEFAS,...(p._cenefasCustom||[])].find(x=>x.id===p.cenefaId);
      if(cn){
        const cnName=cn.nombre.replace(/^Cenefa\s+/i,"");
        parts.push("CENEFA "+cnName.toUpperCase());
      }
    }
    if(p.perfiles)parts.push("PERFILES");
  } else {
    const tela=telas.find(t=>t.id===p.telaId);
    const conf=confecciones.find(c=>c.id===p.confeccionId);
    if(tela){
      const telaName=tela.nombre.replace(/^(Tela|Cortina)\s+/i,"");
      parts.push("CORTINA "+telaName.toUpperCase());
    }
    if(conf)parts.push("CONFECCIÓN "+conf.nombre);
    const riel=[...RIELES,...(rielesCustom||[])].find(r=>r.id===p.rielId);
    if(riel){
      const rielName=riel.nombre.replace(/^Riel\s+/i,"");
      parts.push("RIEL "+rielName.toUpperCase());
    }
    if(p.vaporizacion)parts.push("VAPORIZACIÓN Y PLANCHADO");
    if(p.basta)parts.push("BASTA");
    if(p.dosVias===true)parts.push("2 VÍAS");
    else if(p.dosVias===false)parts.push("1 VÍA");
    if(p.andamio)parts.push("ANDAMIO");
    if(p.tipoAccionamiento==="MOTORIZADA"&&p.controlId){
      const ctrl=[...CORTINA_CONTROLES,...(p._controlesCustom||[])].find(function(x){return x.id===p.controlId;});
      if(ctrl)parts.push("CONTROL "+ctrl.nombre.replace(/^Control\s+/i,"").toUpperCase());
    }
  }
  if(p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE"){
    const parts2=[p.tipoProducto];
    if(p.tipoAccionamiento==="MOTORIZADA"){
      const motores=p.tipoProducto==="TOLDO VERTICAL"?MOTORES_TOLDO:MOTORES_PERGOLA;
      const m=[...motores,...(p._motoresCustom||[])].find(function(x){return x.id===p.motorId;});
      if(m)parts2.push(m.nombre.toUpperCase());
      const ctrl=[...CONTROLES_TOLDO,...(p._controlesCustom||[])].find(function(x){return x.id===p.controlId;});
      if(ctrl)parts2.push(ctrl.nombre.toUpperCase());
    }
    return parts2.join(" + ");
  }
  if(p.tipoProducto==="PAPEL DE PARED"){
    if(!p.papelUsarCalculadora){
      return p.papelDescripcion||(p.papelModo==="ROLLO"?"Papel de pared por rollo":"Papel de pared por yarda");
    }
    return "PAPEL DE PARED POR "+(p.papelModo==="ROLLO"?"ROLLO":"YARDA");
  }
  if(p.tipoProducto==="OTRO"){
    return p.otroDescripcion||"OTRO PRODUCTO";
  }
  return parts.join(" + ");
}

function validatePiece(p, telas) {
  const allTelas = telas || DEFAULT_TELAS;
  const errors = {};
  if (p.tipoProducto === "PERSIANA") {
    if (!p.tipoPersiana) errors.tipoPersiana = "Selecciona el tipo de persiana";
    if (!p.ancho) errors.ancho = "Ingresa el ancho";
    if (!p.alto) errors.alto = "Ingresa el alto";
    if (p.cenefa && !p.cenefaId) errors.cenefaId = "Selecciona el tipo de cenefa";
  } else if (p.tipoProducto === "CORTINA DE TELA") {
    if (!p.ancho) errors.ancho = "Ingresa el ancho";
    if (!p.alto) errors.alto = "Ingresa el alto";
    if (!p.tipoAccionamiento) errors.tipoAccionamiento = "Selecciona accionamiento";
    if (!p.telaId || !allTelas.find(function(t){return t.id===p.telaId;})) errors.telaId = "Selecciona o agrega una tela";
    if (!p.confeccionId) errors.confeccionId = "Selecciona el tipo de confección";
    if (!p.rielId) errors.rielId = "Selecciona un riel";
    if (p.dosVias === null || p.dosVias === undefined) errors.dosVias = "Selecciona las vías";
  }
  if(p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE"){
    if(!p.ancho) errors.ancho="Ingresa el ancho";
    if(!p.alto) errors.alto="Ingresa el alto";
  }
  // PAPEL DE PARED: obligatorio si usa calculadora
  if (p.tipoProducto === "PAPEL DE PARED" && p.papelUsarCalculadora) {
    if (!p.papelAnchoRollo) errors.papelAnchoRollo = "Ingresa el ancho del rollo/material";
    if (p.papelModo === "ROLLO") {
      if (!p.papelLargoRollo) errors.papelLargoRollo = "Ingresa el largo del rollo";
    }
    const paredes = p.papelParedes || [];
    const paredErrors = [];
    paredes.forEach(function(pw, i) {
      const pe = {};
      if (!pw.ancho) pe.ancho = true;
      if (!pw.alto) pe.alto = true;
      if (Object.keys(pe).length > 0) paredErrors.push(i);
    });
    if (paredErrors.length > 0) {
      errors.papelParedes = "Ingresa ancho y alto en todas las paredes (paredes " + paredErrors.map(function(i){return i+1;}).join(", ") + ")";
    }
  }
  // OTRO: sin campos obligatorios
  return errors;
}

function isPieceValid(p, telas) {
  return Object.keys(validatePiece(p, telas)).length === 0;
}

const newPiece=()=>({
  id:uid(),tipoProducto:"PERSIANA",area:"",ancho:"",alto:"",cantidad:1,
  tipoPersiana:"",mult:null,precioAjustadoManual:null,tipoAccionamiento:"MANUAL",ladoCadena:"DERECHO",enrollado:"DELANTERO",
  motorId:"",controlId:"",cenefa:false,cenefaId:"",cenefaML:null,cenefaMLManual:null,instCenefaPrecio:null,
  perfiles:false,perfilesML:null,perfilesMLManual:null,perfilPrecioUnit:null,instPerfilesPrecio:null,instalacionPrecio:null,incluyeInstalacion:true,
  extras:[],telaId:"",confeccionId:"",rielId:"",dosVias:true,vaporizacion:false,basta:false,andamio:false,confeccionPrecioUnit:null,
  // Papel de pared
  papelModo:"ROLLO",papelParedes:[{id:"pw1",nombre:"",ancho:"",alto:""}],
  papelAnchoRollo:"",papelLargoRollo:"",papelRepeticion:"",papelPrecioUnit:"",
  papelCantidadManual:"",papelUsarCalculadora:true,papelServicios:[],papelDescripcion:"",
  // Otro
  otroDescripcion:"",otroCantidad:1,otroPrecioUnit:"",
});

// ─── EXTRAS ───────────────────────────────────────────────────────────────────
const EXTRAS_UNIDAD=[{id:"eu1",nombre:"Andamio",precio:150},{id:"eu2",nombre:"Tubo reforzado",precio:150},{id:"eu3",nombre:"Motor TBC 1L",precio:170},{id:"eu4",nombre:"Motor TBC 2L",precio:262},{id:"eu5",nombre:"Motor TBC 3L",precio:437},{id:"eu6",nombre:"Motor TBC 1L WIFI",precio:210},{id:"eu7",nombre:"Motor Somfy 1L",precio:342},{id:"eu8",nombre:"Motor Somfy 2L",precio:437},{id:"eu9",nombre:"Control unicanal TBC",precio:35},{id:"eu10",nombre:"Control multicanal TBC",precio:50},{id:"eu11",nombre:"Control unicanal Somfy",precio:99},{id:"eu12",nombre:"Control multicanal Somfy",precio:139},{id:"eu13",nombre:"Soporte especial",precio:25},{id:"eu14",nombre:"Instalación persiana manual",precio:25},{id:"eu15",nombre:"Instalación persiana motorizada",precio:50},{id:"eu16",nombre:"Instalación cortina manual",precio:50},{id:"eu17",nombre:"Instalación cortina motorizada",precio:100}];
const EXTRAS_ML=[{id:"em1",nombre:"Cenefa PVC",precio:30},{id:"em2",nombre:"Cenefa Casette",precio:35},{id:"em3",nombre:"Perfil lateral",precio:30},{id:"em4",nombre:"Riel hotelero",precio:55},{id:"em5",nombre:"Riel Ripplefold",precio:60}];
const SS={background:"rgba(201,168,76,.04)",border:`1px solid rgba(201,168,76,.15)`,borderRadius:10,padding:"14px 16px",marginBottom:12};

function ExtraRow({e,onUpdate,onRemove,isML}){
  const precio=parseFloat(e.precio)||0;
  const qty=isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
  return(
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap",padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:8}}>
      {(function(){const img=getExtraImage(e.nombre);return img?<img src={img} style={{width:36,height:36,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:null;})()}
      <input style={{...S.inp,flex:2,minWidth:130}} value={e.nombre} onChange={function(ev){onUpdate("nombre",ev.target.value);}}/>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{color:"#aaa",fontSize:11}}>${isML?"/ml":"/ud"}</span>
        <input type="number" style={{...S.inp,width:80}} value={e.precio}
          onChange={function(ev){onUpdate("precio",ev.target.value===""?"":ev.target.value);}}
          onBlur={function(ev){const v=parseFloat(ev.target.value);onUpdate("precio",isNaN(v)?0:v);}}/>
      </div>
      {isML?(
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:"#aaa",fontSize:11}}>ml</span>
          <input type="number" step="0.01" style={{...S.inp,width:75}} value={e.metros}
            onChange={function(ev){onUpdate("metros",ev.target.value===""?"":ev.target.value);}}
            onBlur={function(ev){const v=parseFloat(ev.target.value);onUpdate("metros",isNaN(v)?0:v);}}/>
        </div>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:"#aaa",fontSize:11}}>×</span>
          <input type="number" min="1" style={{...S.inp,width:60}} value={e.cantidad}
            onChange={function(ev){onUpdate("cantidad",ev.target.value===""?"":ev.target.value);}}
            onBlur={function(ev){const v=parseInt(ev.target.value);onUpdate("cantidad",isNaN(v)||v<1?1:v);}}/>
        </div>
      )}
      <span style={{color:C.goldL,fontSize:12,fontWeight:700,minWidth:64,textAlign:"right"}}>{fmt(precio*qty)}</span>
      <button style={S.removeBtn} onClick={onRemove}>✕</button>
    </div>
  );
}

function AddExtraRow({catalog,isML,onAdd,onPendingChange}){
  const[mode,setMode]=useState("cat");
  const[catId,setCatId]=useState("");
  const[nombre,setNombre]=useState("");
  const[precio,setPrecio]=useState("");
  function notifyPending(newCatId,newNombre,newPrecio,newMode){
    const m=newMode!==undefined?newMode:mode;
    const pending=m==="cat"?(newCatId!==undefined?newCatId:catId)!=="":((newNombre!==undefined?newNombre:nombre)!=="")||(newPrecio!==undefined?newPrecio:precio)!=="";
    if(onPendingChange)onPendingChange(pending);
  }
  function handleAdd(){
    if(mode==="cat"){if(!catId)return;const cat=catalog.find(function(c){return c.id===catId;});if(!cat)return;const item={id:uid(),nombre:cat.nombre,precio:cat.precio};if(isML){item.metros=1;}else{item.cantidad=1;}onAdd(item);setCatId("");if(onPendingChange)onPendingChange(false);}
    else{if(!nombre||!precio)return;const item={id:uid(),nombre:nombre,precio:parseFloat(precio)||0,custom:true};if(isML){item.metros=1;}else{item.cantidad=1;}onAdd(item);setNombre("");setPrecio("");if(onPendingChange)onPendingChange(false);}
  }
  return(
    <div style={{background:"rgba(201,168,76,.04)",border:`1px dashed ${C.border}`,borderRadius:8,padding:"10px 12px",marginTop:6}}>
      <div style={{display:"flex",gap:7,marginBottom:8}}>
        <div style={{...S.radio(mode==="cat"),cursor:"pointer",fontSize:11}} onClick={function(){setMode("cat");notifyPending(catId,nombre,precio,"cat");}}>Del catálogo</div>
        <div style={{...S.radio(mode==="custom"),cursor:"pointer",fontSize:11}} onClick={function(){setMode("custom");notifyPending(catId,nombre,precio,"custom");}}>Personalizado</div>
      </div>
      {mode==="cat"?(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <select style={{...S.sel,flex:1,minWidth:180}} value={catId} onChange={function(e){setCatId(e.target.value);notifyPending(e.target.value,nombre,precio);}}>
            <option value="">Seleccionar...</option>
            {catalog.map(function(c){return <option key={c.id} value={c.id}>{c.nombre} — {fmt(c.precio)}{isML?"/ml":""}</option>;})}
          </select>
          <div style={{...S.radio(true),cursor:"pointer",padding:"7px 16px",
            ...(catId?{background:"rgba(184,150,90,.25)",borderColor:C.gold,color:C.goldL,animation:"tbcPulse 1.4s ease-in-out infinite",fontWeight:800}:{})
          }} onClick={handleAdd}>{catId?"⚠ Confirmar agregar":"+ Agregar"}</div>
        </div>
      ):(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <input style={{...S.inp,flex:2,minWidth:130}} placeholder="Nombre" value={nombre} onChange={function(e){setNombre(e.target.value);notifyPending(catId,e.target.value,precio);}}/>
          <input type="number" style={{...S.inp,width:95}} placeholder={isML?"$/ml":"Precio $"} value={precio} onChange={function(e){setPrecio(e.target.value);notifyPending(catId,nombre,e.target.value);}}/>
          <div style={{...S.radio(true),cursor:"pointer",padding:"7px 16px",
            ...((nombre||precio)?{background:"rgba(184,150,90,.25)",borderColor:C.gold,color:C.goldL,animation:"tbcPulse 1.4s ease-in-out infinite",fontWeight:800}:{})
          }} onClick={handleAdd}>{(nombre||precio)?"⚠ Confirmar agregar":"+ Agregar"}</div>
        </div>
      )}
    </div>
  );
}

function ExtrasSection({extras,onChange,onPendingChange}){
  if(!extras)extras=[];
  const unidadItems=extras.filter(function(e){return !e.isML;});
  const mlItems=extras.filter(function(e){return e.isML;});
  const[unidadPendiente,setUnidadPendiente]=useState(false);
  const[mlPendiente,setMlPendiente]=useState(false);
  function notifyUp(u,m){if(onPendingChange)onPendingChange(u||m);}
  function addUnidad(item){onChange([...extras,{...item,isML:false}]);}
  function addML(item){onChange([...extras,{...item,isML:true}]);}
  function removeExtra(id){onChange(extras.filter(function(e){return e.id!==id;}));}
  function updateExtra(id,key,val){onChange(extras.map(function(e){return e.id===id?{...e,[key]:val}:e;}));}
  return(
    <div style={{marginTop:4}}>
      <div style={{...S.lbl,marginBottom:12,color:C.goldL}}>📦 Artículos y Extras Adicionales</div>
      <div style={{fontSize:11,color:C.muted,marginBottom:14,lineHeight:1.6}}>Podés agregar cualquier artículo extra sin necesidad de seleccionar una persiana o cortina.</div>
      <div style={SS}>
        <div style={{...S.lbl,marginBottom:10,color:"#88aaff"}}>🔧 Por Unidad</div>
        {unidadItems.map(function(e){return(<ExtraRow key={e.id} e={e} isML={false} onUpdate={function(k,v){updateExtra(e.id,k,v);}} onRemove={function(){removeExtra(e.id);}}/>);})}
        <AddExtraRow catalog={EXTRAS_UNIDAD} isML={false} onAdd={addUnidad} onPendingChange={function(p){setUnidadPendiente(p);notifyUp(p,mlPendiente);}}/>
      </div>
      <div style={SS}>
        <div style={{...S.lbl,marginBottom:10,color:"#88cc99"}}>📏 Por Metro Lineal</div>
        {mlItems.map(function(e){return(<ExtraRow key={e.id} e={e} isML={true} onUpdate={function(k,v){updateExtra(e.id,k,v);}} onRemove={function(){removeExtra(e.id);}}/>);})}
        <AddExtraRow catalog={EXTRAS_ML} isML={true} onAdd={addML} onPendingChange={function(p){setMlPendiente(p);notifyUp(unidadPendiente,p);}}/>
      </div>
    </div>
  );
}

function ExtrasRows({extras}){
  if(!extras||extras.length===0)return null;
  return extras.map(function(e){
    const pr=parseFloat(e.precio)||0;
    const q=e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
    const lbl=e.isML?(e.nombre+" ("+q+"ml × "+fmt(pr)+"/ml)"):(q>1?e.nombre+" × "+q:e.nombre);
    return(<div key={e.id} style={S.priceRow}><span>{lbl}</span><span>{fmt(pr*q)}</span></div>);
  });
}

// ─── COMPONENTE REUTILIZABLE: AGREGAR ITEM PERSONALIZADO (motor/control/cenefa) ──
function CustomItemAdder({label,onAdd,unidad,onPendingChange}){
  const[adding,setAdding]=useState(false);
  const[nombre,setNombre]=useState("");
  const[precio,setPrecio]=useState("");
  const pending=adding&&(nombre!==""||precio!=="");
  React.useEffect(function(){
    if(onPendingChange)onPendingChange(pending);
    return function(){if(onPendingChange)onPendingChange(false);};
  },[pending]);
  function handleAdd(){
    if(!nombre||precio==="")return;
    onAdd({id:uid(),nombre:nombre,precio:parseFloat(precio)||0,custom:true});
    setNombre("");setPrecio("");setAdding(false);
    if(onPendingChange)onPendingChange(false);
  }
  if(!adding)return <div style={{...S.addBtn,marginTop:8}} onClick={function(){setAdding(true);}}>+ {label}</div>;
  const addBtnStyle=pending?{...S.radio(true),cursor:"pointer",background:"rgba(184,150,90,.25)",borderColor:C.gold,color:C.goldL,animation:"tbcPulse 1.4s ease-in-out infinite",fontWeight:800}:{...S.radio(true),cursor:"pointer"};
  return(
    <div style={{...S.card,marginTop:8,padding:"14px 18px"}}>
      <div style={{...S.lbl,marginBottom:10,color:C.goldL}}>{label}</div>
      <div style={{...S.g2,marginBottom:10}}>
        <div style={S.field}><div style={S.lbl}>Nombre</div><input style={S.inp} value={nombre} onChange={function(e){setNombre(e.target.value);}} placeholder="ej. Modelo especial"/></div>
        <div style={S.field}><div style={S.lbl}>Precio ($){unidad?" / "+unidad:""}</div><input type="number" step="0.01" style={S.inp} value={precio} onChange={function(e){setPrecio(e.target.value);}} placeholder="0.00"/></div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <div style={addBtnStyle} onClick={handleAdd}>{pending?"⚠ Confirmar agregar":"✓ Agregar"}</div>
        <div style={{...S.radio(false),cursor:"pointer"}} onClick={function(){setAdding(false);setNombre("");setPrecio("");if(onPendingChange)onPendingChange(false);}}>Cancelar</div>
      </div>
    </div>
  );
}

// ─── PERSIANA FORM ─────────────────────────────────────────────────────────────
function PersianaForm({p,update,updateMany,motoresCustom,setMotoresCustom,controlesCustom,setControlesCustom,cenefasCustom,setCenefasCustom,makePendingHandler,pieceIdx,errors}){
  if(!errors)errors={};
  const ancho=parseFloat(p.ancho)||0,alto=parseFloat(p.alto)||0;
  const altoDoble=alto>350,motorizado=p.tipoAccionamiento==="MOTORIZADA";
  const instBase=altoDoble?(motorizado?INST_ROLLER_MOTOR_DBL:INST_ROLLER_MANUAL_DBL):(motorizado?INST_ROLLER_MOTOR:INST_ROLLER_MANUAL);
  const{wErr,hErr}=p.tipoPersiana?validateDims(p.tipoPersiana,ancho,alto):{wErr:null,hErr:null};
  const range=p.tipoPersiana?getRange(p.tipoPersiana):null;
  const calc=calcPersianaTotal(p);
  const defaultMult=p.tipoPersiana?(TABLES[p.tipoPersiana]?.mult||1):1;
  const multVal=p.mult??defaultMult;
  const errS={...S.inp,borderColor:"#ff6060",color:"#ff8080"};
  const isDual=p.tipoPersiana==="LUXURY DUAL CRYSTALLINE"||p.tipoPersiana==="LUXURY DUAL OPAQUE"||p.tipoPersiana==="SHANGRI-LA";
  const motoresCatalogo=[...MOTORES,...(motoresCustom||[])];
  const motoresDisponibles=isDual?motoresCatalogo.filter(m=>m.nombre.includes("1L")||m.custom):motoresCatalogo;
  const controlesCatalogo=[...PERSIANA_CONTROLES,...(controlesCustom||[])];
  const cenefasCatalogo=[...CENEFAS,...(cenefasCustom||[])];
  return(<>
    <div style={{...S.field,marginBottom:14}}>
      <div style={{...S.lbl,color:errors.tipoPersiana?"#E05555":"#ccc"}}>Tipo de Persiana {errors.tipoPersiana&&<span style={{color:"#E05555"}}>*</span>}</div>
      <select style={{...S.sel,borderColor:errors.tipoPersiana?"#E05555":undefined}} value={p.tipoPersiana} onChange={function(e){update("tipoPersiana",e.target.value);}}>
        <option value="">Seleccionar...</option>
        {Object.keys(TABLES).map(function(t){return <option key={t}>{t}</option>;})}
      </select>
      {errors.tipoPersiana&&<div style={{fontSize:10,color:"#E05555",marginTop:3}}>⚠ {errors.tipoPersiana}</div>}
      {range&&<div style={S.tip}>Rango: ancho {range.minW}–{range.maxW}cm | alto {range.minH}–{range.maxH}cm</div>}
    </div>
    <div style={{...S.g3,marginBottom:14}}>
      <div style={S.field}>
        <div style={{...S.lbl,color:errors.ancho?"#E05555":"#ccc"}}>Ancho (cm) {errors.ancho&&<span style={{color:"#E05555"}}>*</span>}</div>
        <input type="number" style={wErr?errS:{...S.inp,borderColor:errors.ancho?"#E05555":undefined}} placeholder="ej. 152" value={p.ancho}
          onChange={function(e){update("ancho",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseFloat(e.target.value);update("ancho",isNaN(v)?"":v);}}/>
        {wErr&&<div style={{fontSize:10,color:"#ff6060",marginTop:2}}>⚠ {wErr}</div>}
        {!wErr&&errors.ancho&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.ancho}</div>}
      </div>
      <div style={S.field}>
        <div style={{...S.lbl,color:errors.alto?"#E05555":"#ccc"}}>Alto (cm) {errors.alto&&<span style={{color:"#E05555"}}>*</span>}</div>
        <input type="number" style={hErr?errS:{...S.inp,borderColor:errors.alto?"#E05555":undefined}} placeholder="ej. 182" value={p.alto}
          onChange={function(e){update("alto",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseFloat(e.target.value);update("alto",isNaN(v)?"":v);}}/>
        {hErr&&<div style={{fontSize:10,color:"#ff6060",marginTop:2}}>⚠ {hErr}</div>}
        {!hErr&&errors.alto&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.alto}</div>}
      </div>
      <div style={S.field}>
        <div style={S.lbl}>Cantidad de Piezas</div>
        <input type="number" min="1" style={S.inp} value={p.cantidad??1}
          onChange={function(e){update("cantidad",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseInt(e.target.value);update("cantidad",isNaN(v)||v<1?1:v);}}/>
      </div>
    </div>
    {p.tipoPersiana&&!wErr&&!hErr&&ancho&&alto&&(
      <div style={{...S.g3,marginBottom:14}}>
        <div style={S.field}>
          <div style={S.lbl}>Precio de Lista</div>
          <input style={{...S.inp,color:C.goldL,fontWeight:700}} readOnly value={calc?fmt(calc.base):"—"}/>
        </div>
        <div style={S.field}>
          <div style={S.lbl}>Multiplicador (editable)</div>
          <input type="number" step="0.01" style={{...S.inp,color:C.gold,fontWeight:700}} value={multVal}
            onChange={function(e){update("mult",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseFloat(e.target.value);update("mult",isNaN(v)?defaultMult:v);}}/>
          <div style={S.tip}>Pred: × {defaultMult}</div>
        </div>
        <div style={S.field}>
          <div style={S.lbl}>Precio con Descuento (editable)</div>
          <input type="number" step="0.01" style={{...S.inp,color:C.green,fontWeight:700}}
            value={p.precioAjustadoManual!==null&&p.precioAjustadoManual!==undefined ? p.precioAjustadoManual : (calc?calc.ajustado:"")}
            onChange={function(e){update("precioAjustadoManual",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseFloat(e.target.value);update("precioAjustadoManual",isNaN(v)?null:v);}}/>
          <div style={S.tip}>Calculado: {calc?fmt(calc.ajustadoCalculado):"—"}</div>
        </div>
      </div>
    )}
    <div style={{...S.field,marginBottom:14}}>
      <div style={S.lbl}>Accionamiento</div>
      <div style={S.radioRow}>
        {["MANUAL","MOTORIZADA"].map(function(t){return <div key={t} style={S.radio(p.tipoAccionamiento===t)} onClick={function(){if(t==="MANUAL"){updateMany({tipoAccionamiento:"MANUAL",motorId:"",controlId:""});}else{update("tipoAccionamiento",t);}}}>{t}</div>;})}
      </div>
    </div>
    {motorizado&&(
      <div style={{marginBottom:14}}>
        <div style={S.g2}>
          <div style={S.field}>
            <div style={S.lbl}>Motor{isDual&&<span style={{color:"#ff9944",marginLeft:6,fontSize:10}}>Solo 1L</span>}</div>
            <select style={S.sel} value={p.motorId} onChange={function(e){update("motorId",e.target.value);}}>
              <option value="">Sin motor</option>
              {motoresDisponibles.map(function(m){return <option key={m.id} value={m.id}>{m.nombre} — {fmt(m.precio)}</option>;})}
            </select>
          </div>
          <div style={S.field}>
            <div style={S.lbl}>Control Remoto</div>
            <select style={S.sel} value={p.controlId} onChange={function(e){update("controlId",e.target.value);}}>
              <option value="">Sin control</option>
              {controlesCatalogo.map(function(c){return <option key={c.id} value={c.id}>{c.nombre} — {fmt(c.precio)}</option>;})}
            </select>
          </div>
        </div>
        <div style={S.g2}>
          <CustomItemAdder label="Agregar motor personalizado" onAdd={function(item){setMotoresCustom(function(prev){return[...prev,item];});update("motorId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-pers-motor"):undefined}/>
          <CustomItemAdder label="Agregar control personalizado" onAdd={function(item){setControlesCustom(function(prev){return[...prev,item];});update("controlId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-pers-control"):undefined}/>
        </div>
      </div>
    )}

    <div style={S.divider}/>
    {isDual&&(
      <div style={{...S.infoRow,marginBottom:14,color:"#c9a84c",borderColor:"rgba(201,168,76,.3)",background:"rgba(201,168,76,.06)"}}>
        ℹ️ <strong>{p.tipoPersiana}:</strong> la cenefa viene incorporada y los perfiles no aplican.
      </div>
    )}
    {!isDual&&(
      <div style={{marginBottom:14}}>
        <div style={{...S.lbl,marginBottom:8}}>¿Lleva Cenefa?</div>
        <div style={S.radioRow}>
          <div style={S.radio(p.cenefa===true)} onClick={function(){update("cenefa",true);}}>SÍ</div>
          <div style={S.radio(p.cenefa===false)} onClick={function(){update("cenefa",false);}}>NO</div>
        </div>
        {p.cenefa&&(<>
          <div style={{...S.g3,marginTop:12}}>
            <div style={S.field}>
              <div style={{...S.lbl,color:errors.cenefaId?"#E05555":"#ccc"}}>Tipo de Cenefa {errors.cenefaId&&<span style={{color:"#E05555"}}>*</span>}</div>
              <select style={{...S.sel,borderColor:errors.cenefaId?"#E05555":undefined}} value={p.cenefaId} onChange={function(e){update("cenefaId",e.target.value);}}>
                <option value="">Seleccionar...</option>
                {cenefasCatalogo.map(function(c){return <option key={c.id} value={c.id}>{c.nombre} — {fmt(c.precio)}/ml</option>;})}
              </select>
              {errors.cenefaId&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.cenefaId}</div>}
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Metros Lineales (editable)</div>
              <input type="number" step="0.01" style={S.inp}
                value={p.cenefaMLManual!==null&&p.cenefaMLManual!==undefined?p.cenefaMLManual:(+(ancho/100).toFixed(2))}
                onChange={function(e){update("cenefaMLManual",e.target.value);}}
                onBlur={function(e){if(e.target.value===""){update("cenefaMLManual",null);}else{const v=parseFloat(e.target.value);update("cenefaMLManual",isNaN(v)?null:v);}}}/>
              <div style={S.tip}>Auto: {ancho}cm÷100={+(ancho/100).toFixed(2)}ml</div>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Inst. Cenefa ($)</div>
              <input type="number" style={S.inp} value={p.instCenefaPrecio??INST_CENEFA}
                onChange={function(e){update("instCenefaPrecio",e.target.value===""?"":e.target.value);}}
                onBlur={function(e){const v=parseFloat(e.target.value);update("instCenefaPrecio",isNaN(v)?INST_CENEFA:v);}}/>
            </div>
          </div>
          <CustomItemAdder label="Agregar tipo de cenefa personalizada" unidad="ml" onAdd={function(item){setCenefasCustom(function(prev){return[...prev,item];});update("cenefaId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-pers-cenefa"):undefined}/>
        </>)}
      </div>
    )}
    {!isDual&&(
      <div style={{marginBottom:14}}>
        <div style={{...S.lbl,marginBottom:8}}>¿Lleva Perfiles?</div>
        <div style={S.radioRow}>
          <div style={S.radio(p.perfiles===true)} onClick={function(){update("perfiles",true);}}>SÍ</div>
          <div style={S.radio(p.perfiles===false)} onClick={function(){update("perfiles",false);}}>NO</div>
        </div>
        {p.perfiles&&(
          <div style={{...S.g3,marginTop:12}}>
            <div style={S.field}>
              <div style={S.lbl}>Precio Perfil ($/ml, editable)</div>
              <input type="number" step="0.01" style={S.inp}
                value={p.perfilPrecioUnit!==null&&p.perfilPrecioUnit!==undefined?p.perfilPrecioUnit:30}
                onChange={function(e){update("perfilPrecioUnit",e.target.value);}}
                onBlur={function(e){if(e.target.value===""){update("perfilPrecioUnit",null);}else{const v=parseFloat(e.target.value);update("perfilPrecioUnit",isNaN(v)?null:v);}}}/>
              <div style={S.tip}>Pred: $30/ml</div>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Metros Lineales Par (editable)</div>
              <input type="number" step="0.01" style={S.inp}
                value={p.perfilesMLManual!==null&&p.perfilesMLManual!==undefined?p.perfilesMLManual:(+(alto/100*2).toFixed(2))}
                onChange={function(e){update("perfilesMLManual",e.target.value);}}
                onBlur={function(e){if(e.target.value===""){update("perfilesMLManual",null);}else{const v=parseFloat(e.target.value);update("perfilesMLManual",isNaN(v)?null:v);}}}/>
              <div style={S.tip}>Auto: {alto}cm÷100×2={+(alto/100*2).toFixed(2)}ml</div>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Inst. Perfiles ($)</div>
              <input type="number" style={S.inp} value={p.instPerfilesPrecio??INST_PERFILES}
                onChange={function(e){update("instPerfilesPrecio",e.target.value===""?"":e.target.value);}}
                onBlur={function(e){const v=parseFloat(e.target.value);update("instPerfilesPrecio",isNaN(v)?INST_PERFILES:v);}}/>
            </div>
          </div>
        )}
      </div>
    )}
    <div style={S.divider}/>
    <div style={{...S.chk,marginBottom:8}} onClick={function(){update("incluyeInstalacion",!p.incluyeInstalacion);}}>
      <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.incluyeInstalacion?C.gold:C.border}`,background:p.incluyeInstalacion?"rgba(201,168,76,.3)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {p.incluyeInstalacion&&<span style={{color:C.goldL,fontSize:12,fontWeight:900}}>✓</span>}
      </div>
      <span style={{fontSize:12,fontWeight:600,color:p.incluyeInstalacion?C.goldL:C.muted}}>Incluye Instalación</span>
    </div>
    {p.incluyeInstalacion&&(
      <div style={{...S.field,marginBottom:14}}>
        <div style={S.lbl}>Precio Instalación — editable</div>
        <input type="number" style={S.inp} value={p.instalacionPrecio??instBase}
          onChange={function(e){update("instalacionPrecio",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseFloat(e.target.value);update("instalacionPrecio",isNaN(v)?instBase:v);}}/>
        <div style={S.tip}>Base: {fmt(instBase)}{altoDoble?" · doble altura":""}{motorizado?" · motorizada":""}</div>
      </div>
    )}
    {altoDoble&&<div style={S.infoRow}>⚠️ Alto &gt; 350cm — tarifa de doble altura aplicada</div>}
    <div style={S.divider}/>
    {calc&&(
      <div style={{...S.priceBox,marginTop:16}}>
        {p.cantidad>1&&<div style={{...S.priceRow,color:C.gold,fontWeight:700}}><span>Precio × 1 pieza</span><span>{fmt(calc.subtotal)}</span></div>}
        {p.cantidad>1&&<div style={S.priceRow}><span>Cantidad</span><span>× {calc.cantidad}</span></div>}
        <div style={S.priceRow}><span>Precio lista</span><span>{fmt(calc.base)}</span></div>
        <div style={S.priceRow}><span>Precio con descuento (× {calc.mult})</span><span>{fmt(calc.ajustado)}</span></div>
        {p.incluyeInstalacion&&<div style={S.priceRow}><span>Instalación{calc.anchoDobleRiel?" × 2 (ancho >280cm)":""}</span><span>{fmt(calc.instPrecio)}</span></div>}
        {calc.motorPrecio>0&&<div style={S.priceRow}><span>Motor</span><span>{fmt(calc.motorPrecio)}</span></div>}
        {calc.controlPrecio>0&&<div style={S.priceRow}><span>Control</span><span>{fmt(calc.controlPrecio)}</span></div>}
        {p.cenefa&&calc.cenefaPrecio>0&&<div style={S.priceRow}><span>Cenefa ({calc.cenefaML.toFixed(2)}ml)</span><span>{fmt(calc.cenefaPrecio)}</span></div>}
        {p.cenefa&&<div style={S.priceRow}><span>Inst. Cenefa</span><span>{fmt(calc.instCenefaPrecio)}</span></div>}
        {p.perfiles&&calc.perfilesPrecio>0&&<div style={S.priceRow}><span>Perfiles ({calc.perfilesML.toFixed(2)}ml×$30)</span><span>{fmt(calc.perfilesPrecio)}</span></div>}
        {p.perfiles&&<div style={S.priceRow}><span>Inst. Perfiles</span><span>{fmt(calc.instPerfilesPrecio)}</span></div>}
        <div style={S.totalRow}><span>TOTAL {p.cantidad>1?"("+p.cantidad+" piezas)":"PIEZA"}</span><span>{fmt(calc.total)}</span></div>
      </div>
    )}

  </>);
}

// ─── CORTINA FORM ──────────────────────────────────────────────────────────────
function CortinaForm({p,update,updateMany,telas,setTelas,confecciones,setConfecciones,rielesCustom,setRielesCustom,controlesCustom,setControlesCustom,makePendingHandler,pieceIdx,errors}){
  if(!errors)errors={};
  const[addingTela,setAddingTela]=useState(false);
  const[newTela,setNewTela]=useState({nombre:"",precio:""});
  const[addingConf,setAddingConf]=useState(false);
  const[newConf,setNewConf]=useState({nombre:"",divisor:""});
  const[addingRiel,setAddingRiel]=useState(false);
  const[newRiel,setNewRiel]=useState({nombre:"",precio:""});
  const altoDoble=(p.alto||0)>350,motorizado=p.tipoAccionamiento==="MOTORIZADA";
  const instBase=altoDoble?(motorizado?INST_CORTINA_MOTOR_DBL:INST_CORTINA_MANUAL_DBL):(motorizado?INST_CORTINA_MOTOR:INST_CORTINA_MANUAL);
  const confPrecioBase=altoDoble?48:24;
  const calc=(p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto)?calcCortinaTotal(p,telas,confecciones,rielesCustom||[]):null;
  function addTela(){if(!newTela.nombre||!newTela.precio)return;const t={id:uid(),nombre:newTela.nombre,precio:parseFloat(newTela.precio),unidad:"Yarda Doble"};setTelas(function(prev){return[...prev,t];});update("telaId",t.id);setNewTela({nombre:"",precio:""});setAddingTela(false);}
  function addConf(){if(!newConf.nombre||!newConf.divisor)return;const c={id:uid(),nombre:newConf.nombre,divisor:parseInt(newConf.divisor)};setConfecciones(function(prev){return[...prev,c];});update("confeccionId",c.id);setNewConf({nombre:"",divisor:""});setAddingConf(false);}
  function addRiel(){if(!newRiel.nombre||!newRiel.precio)return;const r={id:uid(),nombre:newRiel.nombre,precio:parseFloat(newRiel.precio),unidad:"Metro Lineal",custom:true};setRielesCustom(function(prev){return[...prev,r];});update("rielId",r.id);setNewRiel({nombre:"",precio:""});setAddingRiel(false);}
  return(<>
    <div style={{...S.g3,marginBottom:14}}>
      <div style={S.field}>
        <div style={{...S.lbl,color:errors.ancho?"#E05555":"#ccc"}}>Ancho (cm) {errors.ancho&&<span style={{color:"#E05555"}}>*</span>}</div>
        <input type="number" style={{...S.inp,borderColor:errors.ancho?"#E05555":undefined}} placeholder="ej. 200" value={p.ancho} onChange={function(e){update("ancho",e.target.value===""?"":e.target.value);}} onBlur={function(e){const v=parseFloat(e.target.value);update("ancho",isNaN(v)?"":v);}}/>
        {errors.ancho&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.ancho}</div>}
      </div>
      <div style={S.field}>
        <div style={{...S.lbl,color:errors.alto?"#E05555":"#ccc"}}>Alto (cm) {errors.alto&&<span style={{color:"#E05555"}}>*</span>}</div>
        <input type="number" style={{...S.inp,borderColor:errors.alto?"#E05555":undefined}} placeholder="ej. 250" value={p.alto} onChange={function(e){update("alto",e.target.value===""?"":e.target.value);}} onBlur={function(e){const v=parseFloat(e.target.value);update("alto",isNaN(v)?"":v);}}/>
        {errors.alto&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.alto}</div>}
      </div>
      <div style={S.field}>
        <div style={S.lbl}>Cantidad de Piezas</div>
        <input type="number" min="1" style={S.inp} value={p.cantidad??1}
          onChange={function(e){update("cantidad",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseInt(e.target.value);update("cantidad",isNaN(v)||v<1?1:v);}}/>
      </div>
    </div>
    <div style={{...S.field,marginBottom:14}}>
      <div style={{...S.lbl,color:errors.tipoAccionamiento?"#E05555":"#ccc"}}>Accionamiento {errors.tipoAccionamiento&&<span style={{color:"#E05555"}}>*</span>}</div>
      <div style={S.radioRow}>
        <div style={{...S.radio(p.tipoAccionamiento==="MANUAL"),borderColor:errors.tipoAccionamiento?"#E05555":undefined}} onClick={function(){const rielMotorizado=p.rielId&&RIELES.find(function(x){return x.id===p.rielId;})?.nombre.toLowerCase().includes("motorizado");updateMany({tipoAccionamiento:"MANUAL",motorId:"",controlId:"",rielId:rielMotorizado?"":p.rielId});}}>MANUAL</div>
        <div style={{...S.radio(p.tipoAccionamiento==="MOTORIZADA"),borderColor:errors.tipoAccionamiento?"#E05555":undefined}} onClick={function(){const rielManual=p.rielId&&RIELES.find(function(x){return x.id===p.rielId;})&&!RIELES.find(function(x){return x.id===p.rielId;}).nombre.toLowerCase().includes("motorizado");updateMany({tipoAccionamiento:"MOTORIZADA",rielId:rielManual?"":p.rielId});}}>MOTORIZADA</div>
      </div>
      {errors.tipoAccionamiento&&<div style={{fontSize:10,color:"#E05555",marginTop:4}}>⚠ {errors.tipoAccionamiento}</div>}
    </div>
    <div style={{marginBottom:14}}>
      <div style={{...S.lbl,marginBottom:8,color:errors.telaId?"#E05555":"#ccc"}}>Tela {errors.telaId&&<span style={{color:"#E05555"}}>* Selecciona una tela</span>}</div>
      <div style={S.tableBox}>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Producto</th><th style={S.th}>Precio</th><th style={S.th}>Unidad</th><th style={S.th}>Sel.</th></tr></thead>
          <tbody>{telas.map(function(t,i){return(
            <tr key={t.id} style={{background:p.telaId===t.id?"rgba(201,168,76,.12)":i%2===0?C.dark2:C.dark3}}>
              <td style={S.td}>{t.nombre}</td>
              <td style={{...S.td,color:C.goldL,fontWeight:700}}>{fmt(t.precio)}</td>
              <td style={{...S.td,color:C.muted}}>{t.unidad}</td>
              <td style={S.td}><div style={{...S.radio(p.telaId===t.id),display:"inline-flex",cursor:"pointer"}} onClick={function(){update("telaId",t.id);}}>{p.telaId===t.id?"✓":""}</div></td>
            </tr>
          );})}</tbody>
        </table>
      </div>
      {!addingTela?<div style={S.addBtn} onClick={function(){setAddingTela(true);}}>+ Agregar tela</div>:(
        <div style={{...S.card,marginTop:8,padding:"14px 18px"}}>
          <div style={{...S.g2,marginBottom:10}}>
            <div style={S.field}><div style={S.lbl}>Nombre</div><input style={S.inp} value={newTela.nombre} onChange={function(e){setNewTela(function(p){return{...p,nombre:e.target.value};});}} placeholder="Nombre"/></div>
            <div style={S.field}><div style={S.lbl}>Precio ($/yd)</div><input type="number" style={S.inp} value={newTela.precio} onChange={function(e){setNewTela(function(p){return{...p,precio:e.target.value};});}} placeholder="0.00"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{...S.radio(true),cursor:"pointer"}} onClick={addTela}>✓ Agregar</div>
            <div style={{...S.radio(false),cursor:"pointer"}} onClick={function(){setAddingTela(false);}}>Cancelar</div>
          </div>
        </div>
      )}
    </div>
    <div style={{marginBottom:14}}>
      <div style={{...S.lbl,marginBottom:8,color:errors.confeccionId?"#E05555":"#ccc"}}>Tipo de Confección {errors.confeccionId&&<span style={{color:"#E05555"}}>* Selecciona una confección</span>}</div>
      <div style={S.tableBox}>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Confección</th><th style={S.th}>Divisor</th><th style={S.th}>Sel.</th></tr></thead>
          <tbody>{confecciones.map(function(c,i){return(
            <tr key={c.id} style={{background:p.confeccionId===c.id?"rgba(201,168,76,.12)":i%2===0?C.dark2:C.dark3}}>
              <td style={S.td}>{c.nombre}</td>
              <td style={{...S.td,color:C.goldL,fontWeight:700}}>÷ {c.divisor}</td>
              <td style={S.td}><div style={{...S.radio(p.confeccionId===c.id),display:"inline-flex",cursor:"pointer"}} onClick={function(){update("confeccionId",c.id);}}>{p.confeccionId===c.id?"✓":""}</div></td>
            </tr>
          );})}</tbody>
        </table>
      </div>
      {!addingConf?<div style={S.addBtn} onClick={function(){setAddingConf(true);}}>+ Agregar confección</div>:(
        <div style={{...S.card,marginTop:8,padding:"14px 18px"}}>
          <div style={{...S.g2,marginBottom:10}}>
            <div style={S.field}><div style={S.lbl}>Nombre</div><input style={S.inp} value={newConf.nombre} onChange={function(e){setNewConf(function(p){return{...p,nombre:e.target.value};});}} placeholder="Nombre"/></div>
            <div style={S.field}><div style={S.lbl}>Divisor</div><input type="number" style={S.inp} value={newConf.divisor} onChange={function(e){setNewConf(function(p){return{...p,divisor:e.target.value};});}} placeholder="ej. 20"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{...S.radio(true),cursor:"pointer"}} onClick={addConf}>✓ Agregar</div>
            <div style={{...S.radio(false),cursor:"pointer"}} onClick={function(){setAddingConf(false);}}>Cancelar</div>
          </div>
        </div>
      )}
    </div>
    <div style={{...S.field,marginBottom:14}}>
      <div style={{...S.lbl,color:errors.rielId?"#E05555":"#ccc"}}>Riel {errors.rielId&&<span style={{color:"#E05555"}}>* Selecciona un riel</span>}</div>
      <select style={{...S.sel,borderColor:errors.rielId?"#E05555":undefined}} value={p.rielId} onChange={function(e){update("rielId",e.target.value);}}>
        <option value="">Seleccionar riel...</option>
        {RIELES.filter(function(r){
          const esMotorizado=r.nombre.toLowerCase().includes("motorizado");
          if(p.tipoAccionamiento==="MOTORIZADA") return esMotorizado;
          if(p.tipoAccionamiento==="MANUAL") return !esMotorizado;
          return true;
        }).map(function(r){return <option key={r.id} value={r.id}>{r.nombre} — {fmt(r.precio)} / {r.unidad}</option>;})}
        {(rielesCustom||[]).length>0&&<option disabled>── Rieles personalizados ──</option>}
        {(rielesCustom||[]).map(function(r){return <option key={r.id} value={r.id}>{r.nombre} — {fmt(r.precio)} / ml</option>;})}
      </select>
      {errors.rielId&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.rielId}</div>}
      {!addingRiel?<div style={S.addBtn} onClick={function(){setAddingRiel(true);}}>+ Agregar riel personalizado</div>:(
        <div style={{...S.card,marginTop:8,padding:"14px 18px"}}>
          <div style={{...S.lbl,marginBottom:10,color:C.goldL}}>Riel Personalizado</div>
          <div style={{...S.g2,marginBottom:10}}>
            <div style={S.field}><div style={S.lbl}>Nombre del riel</div><input style={S.inp} value={newRiel.nombre} onChange={function(e){setNewRiel(function(prev){return{...prev,nombre:e.target.value};});}} placeholder="ej. Riel Especial XYZ"/></div>
            <div style={S.field}><div style={S.lbl}>Precio ($/ml)</div><input type="number" step="0.01" style={S.inp} value={newRiel.precio} onChange={function(e){setNewRiel(function(prev){return{...prev,precio:e.target.value};});}} placeholder="ej. 45"/></div>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:10}}>El precio se aplicará por metro lineal según el ancho ingresado.</div>
          <div style={{display:"flex",gap:8}}>
            <div style={{...S.radio(true),cursor:"pointer"}} onClick={addRiel}>✓ Agregar</div>
            <div style={{...S.radio(false),cursor:"pointer"}} onClick={function(){setAddingRiel(false);setNewRiel({nombre:"",precio:""});}}>Cancelar</div>
          </div>
        </div>
      )}
    </div>
    <div style={{...S.field,marginBottom:14}}>
      <div style={{...S.lbl,color:errors.dosVias?"#E05555":"#ccc"}}>Vías {errors.dosVias&&<span style={{color:"#E05555"}}>* Selecciona las vías</span>}</div>
      <div style={S.radioRow}>
        <div style={S.radio(p.dosVias===true)} onClick={function(){update("dosVias",true);}}>DOS VÍAS (+10")</div>
        <div style={S.radio(p.dosVias===false)} onClick={function(){update("dosVias",false);}}>UNA VÍA</div>
      </div>
    </div>
    {p.tipoAccionamiento==="MOTORIZADA"&&(function(){
      const rielSel=[...RIELES,...(rielesCustom||[])].find(function(r){return r.id===p.rielId;});
      const rielNombre=rielSel?rielSel.nombre.toLowerCase():"";
      const esTBC=rielNombre.includes("tbc");
      const esCeltic=rielNombre.includes("celtic");
      const esSomfy=rielNombre.includes("somfy");
      const controlesFiltrados=[...CORTINA_CONTROLES,...(controlesCustom||[])].filter(function(c){
        if(c.custom)return true;
        const cn=c.nombre.toLowerCase();
        if(esTBC)return cn.includes("tbc");
        if(esCeltic)return cn.includes("celtic");
        if(esSomfy)return cn.includes("somfy");
        return true;
      });
      return(
        <div style={{marginBottom:14}}>
          <div style={S.field}>
            <div style={S.lbl}>Control Remoto</div>
            <select style={S.sel} value={p.controlId||""} onChange={function(e){update("controlId",e.target.value);}}>
              <option value="">Sin control</option>
              {controlesFiltrados.map(function(c){return <option key={c.id} value={c.id}>{c.nombre} — {fmt(c.precio)}</option>;})}
            </select>
          </div>
          <CustomItemAdder label="Agregar control personalizado" onAdd={function(item){setControlesCustom(function(prev){return[...prev,item];});update("controlId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-cort-control"):undefined}/>
        </div>
      );
    })()}

    <div style={{...S.field,marginBottom:14}}>
      <div style={S.lbl}>Precio Confección por paño — editable{altoDoble&&<span style={{color:"#ff9944",marginLeft:6,fontSize:10}}>DOBLE ALTURA $48</span>}</div>
      <input type="number" style={S.inp} value={p.confeccionPrecioUnit??confPrecioBase}
        onChange={function(e){update("confeccionPrecioUnit",e.target.value===""?"":e.target.value);}}
        onBlur={function(e){const v=parseFloat(e.target.value);update("confeccionPrecioUnit",isNaN(v)?confPrecioBase:v);}}/>
      <div style={S.tip}>Normal: $24/paño | Doble altura: $48/paño</div>
    </div>
    <div style={S.divider}/>
    <div style={{...S.chk,marginBottom:8}} onClick={function(){update("incluyeInstalacion",!p.incluyeInstalacion);}}>
      <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.incluyeInstalacion?C.gold:C.border}`,background:p.incluyeInstalacion?"rgba(201,168,76,.3)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {p.incluyeInstalacion&&<span style={{color:C.goldL,fontSize:12,fontWeight:900}}>✓</span>}
      </div>
      <span style={{fontSize:12,fontWeight:600,color:p.incluyeInstalacion?C.goldL:C.muted}}>Incluye Instalación</span>
    </div>
    {p.incluyeInstalacion&&(
      <div style={{...S.field,marginBottom:14}}>
        <div style={S.lbl}>Precio Instalación — editable</div>
        <input type="number" style={S.inp} value={p.instalacionPrecio??instBase}
          onChange={function(e){update("instalacionPrecio",e.target.value===""?"":e.target.value);}}
          onBlur={function(e){const v=parseFloat(e.target.value);update("instalacionPrecio",isNaN(v)?instBase:v);}}/>
        <div style={S.tip}>Base: {fmt(instBase)}{altoDoble?" · doble altura":""}{motorizado?" · motorizada":""}{calc&&calc.anchoDobleRiel?" · ancho >280cm = 2 instalaciones":""}</div>
      </div>
    )}
    <div style={{...S.field,marginBottom:10}}>
      <div style={S.lbl}>Servicios Adicionales</div>
      <div style={S.radioRow}>
        {[["vaporizacion","Vaporización y Planchado $16"],["basta","Basta en sitio $60"],["andamio","Andamio $150"]].map(function(pair){
          return <div key={pair[0]} style={{...S.radio(p[pair[0]]),cursor:"pointer"}} onClick={function(){update(pair[0],!p[pair[0]]);}}>
            {pair[1]}
          </div>;
        })}
      </div>
    </div>
    {altoDoble&&<div style={S.infoRow}>⚠️ Alto &gt; 350cm — doble altura aplicada (confección $48/paño)</div>}
    {calc&&(
      <div style={S.priceBox}>
        <div style={S.priceRow}><span>Paños: {calc.panos} | Yardas dobles: {calc.yardasDobles}</span><span></span></div>
        <div style={S.priceRow}><span>Confección ({fmt(calc.confeccionPrecioUnit)}/paño × {calc.panos})</span><span>{fmt(calc.confeccionPrecio)}</span></div>
        <div style={S.priceRow}><span>Tela</span><span>{fmt(calc.telaPrecio)}</span></div>
        <div style={S.priceRow}><span>Riel</span><span>{fmt(calc.rielPrecio)}</span></div>
        {p.incluyeInstalacion&&<div style={S.priceRow}><span>Instalación{calc.anchoDobleRiel?" × 2 (ancho >280cm)":""}</span><span>{fmt(calc.instPrecio)}</span></div>}
        {calc.controlPrecio>0&&<div style={S.priceRow}><span>Control</span><span>{fmt(calc.controlPrecio)}</span></div>}
        {calc.vapPrecio>0&&<div style={S.priceRow}><span>Vaporización y Planchado</span><span>{fmt(calc.vapPrecio)}</span></div>}
        {calc.bastaPrecio>0&&<div style={S.priceRow}><span>Basta en sitio</span><span>{fmt(calc.bastaPrecio)}</span></div>}
        {calc.andamioPrecio>0&&<div style={S.priceRow}><span>Andamio</span><span>{fmt(calc.andamioPrecio)}</span></div>}
        <div style={S.totalRow}><span>TOTAL PIEZA</span><span>{fmt(calc.total)}</span></div>
      </div>
    )}
  </>);
}


// ─── TOLDO / PÉRGOLA FORM ─────────────────────────────────────────────────────
function ToldoForm({p, update, updateMany, motoresCustom, setMotoresCustom, controlesCustom, setControlesCustom, makePendingHandler, pieceIdx}) {
  const isToldo = p.tipoProducto==="TOLDO VERTICAL";
  const tabla = isToldo ? TOLDO_VERTICAL : PERGOLA_BRAZO;
  const range = getRangeToldo(tabla);
  const motorized = p.tipoAccionamiento==="MOTORIZADA";
  const motores = [...(isToldo ? MOTORES_TOLDO : MOTORES_PERGOLA),...(motoresCustom||[])];
  const controlesToldoCat = [...CONTROLES_TOLDO,...(controlesCustom||[])];
  const ancho = parseFloat(p.ancho)||0;
  const alto = parseFloat(p.alto)||0;
  const altoDoble = alto > 350;
  const calc = calcToldoTotal(p);
  const defaultMult = tabla.mult;
  const multVal = p.mult!==null&&p.mult!==undefined ? p.mult : defaultMult;
  const instBase = motorized ? INST_TOLDO_MOTOR : INST_TOLDO_MANUAL;

  const wErr = ancho>0&&(ancho<range.minW||ancho>range.maxW) ? "Rango: "+range.minW+"–"+range.maxW+"cm" : null;
  const hErr = alto>0&&(alto<range.minH||alto>range.maxH) ? "Rango: "+range.minH+"–"+range.maxH+"cm" : null;
  const errS = {...S.inp, borderColor:"#ff6060", color:"#ff8080"};

  return (
    <>
      <div style={{...S.field,marginBottom:14}}>
        <div style={S.lbl}>Dimensiones — Rango ancho: {range.minW}–{range.maxW}cm | {isToldo?"alto":"proyección"}: {range.minH}–{range.maxH}cm</div>
      </div>
      <div style={{...S.g3,marginBottom:14}}>
        <div style={S.field}>
          <div style={{...S.lbl,color:wErr?"#E05555":"#ccc"}}>Ancho (cm)</div>
          <input type="number" style={wErr?errS:S.inp} placeholder="ej. 300" value={p.ancho}
            onChange={function(e){update("ancho",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseFloat(e.target.value);update("ancho",isNaN(v)?"":v);}}/>
          {wErr&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {wErr}</div>}
        </div>
        <div style={S.field}>
          <div style={{...S.lbl,color:hErr?"#E05555":"#ccc"}}>{isToldo?"Alto":"Proyección"} (cm)</div>
          <input type="number" style={hErr?errS:S.inp} placeholder={isToldo?"ej. 250":"ej. 200"} value={p.alto}
            onChange={function(e){update("alto",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseFloat(e.target.value);update("alto",isNaN(v)?"":v);}}/>
          {hErr&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {hErr}</div>}
        </div>
        <div style={S.field}>
          <div style={S.lbl}>Cantidad</div>
          <input type="number" min="1" style={S.inp} value={p.cantidad??1}
            onChange={function(e){update("cantidad",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseInt(e.target.value);update("cantidad",isNaN(v)||v<1?1:v);}}/>
        </div>
      </div>

      {calc&&!calc.noDisponible&&ancho&&alto&&!wErr&&!hErr&&(
        <div style={{...S.g3,marginBottom:14}}>
          <div style={S.field}>
            <div style={S.lbl}>Precio de Lista</div>
            <input style={{...S.inp,color:C.goldL,fontWeight:700}} readOnly value={fmt(calc.base)}/>
          </div>
          <div style={S.field}>
            <div style={S.lbl}>Multiplicador (editable)</div>
            <input type="number" step="0.01" style={{...S.inp,color:C.gold,fontWeight:700}} value={multVal}
              onChange={function(e){update("mult",e.target.value===""?"":e.target.value);}}
              onBlur={function(e){const v=parseFloat(e.target.value);update("mult",isNaN(v)?defaultMult:v);}}/>
            <div style={S.tip}>Pred: × {defaultMult}</div>
          </div>
          <div style={S.field}>
            <div style={S.lbl}>Precio con Descuento (editable)</div>
            <input type="number" step="0.01" style={{...S.inp,color:C.green,fontWeight:700}}
              value={p.precioAjustadoManual!==null&&p.precioAjustadoManual!==undefined?p.precioAjustadoManual:fmt(calc.ajustadoCalculado).replace("$","")}
              onChange={function(e){update("precioAjustadoManual",e.target.value===""?"":e.target.value);}}
              onBlur={function(e){const v=parseFloat(e.target.value);update("precioAjustadoManual",isNaN(v)?null:v);}}/>
            <div style={S.tip}>Calculado: {fmt(calc.ajustadoCalculado)}</div>
          </div>
        </div>
      )}

      {calc&&calc.noDisponible&&(
        <div style={{background:"rgba(224,85,85,.1)",border:"1px solid rgba(224,85,85,.3)",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
          <div style={{color:"#E05555",fontWeight:700,fontSize:12}}>⚠ Combinación de medidas no disponible en la tabla de precios</div>
          <div style={{color:"#ff8080",fontSize:11,marginTop:4}}>Verifica las medidas o consulta precio manualmente</div>
        </div>
      )}

      <div style={{...S.field,marginBottom:14}}>
        <div style={S.lbl}>Accionamiento</div>
        <div style={S.radioRow}>
          <div style={S.radio(p.tipoAccionamiento==="MANUAL")} onClick={function(){updateMany({tipoAccionamiento:"MANUAL",motorId:"",controlId:""});}}>MANUAL</div>
          <div style={S.radio(p.tipoAccionamiento==="MOTORIZADA")} onClick={function(){update("tipoAccionamiento","MOTORIZADA");}}>MOTORIZADA</div>
        </div>
      </div>

      {motorized&&(
        <div style={{marginBottom:14}}>
          <div style={S.g2}>
            <div style={S.field}>
              <div style={S.lbl}>Motor</div>
              <select style={S.sel} value={p.motorId||""} onChange={function(e){update("motorId",e.target.value);}}>
                <option value="">Sin motor</option>
                {motores.map(function(m){return(<option key={m.id} value={m.id}>{m.nombre} — {fmt(m.precio)}</option>);})}
              </select>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Control</div>
              <select style={S.sel} value={p.controlId||""} onChange={function(e){update("controlId",e.target.value);}}>
                <option value="">Sin control</option>
                {controlesToldoCat.map(function(ctrl){return <option key={ctrl.id} value={ctrl.id}>{ctrl.nombre} — {fmt(ctrl.precio)}</option>;})}
              </select>
            </div>
          </div>
          <div style={S.g2}>
            <CustomItemAdder label="Agregar motor personalizado" onAdd={function(item){setMotoresCustom(function(prev){return[...prev,item];});update("motorId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-toldo-motor"):undefined}/>
            <CustomItemAdder label="Agregar control personalizado" onAdd={function(item){setControlesCustom(function(prev){return[...prev,item];});update("controlId",item.id);}} onPendingChange={makePendingHandler?makePendingHandler("p"+pieceIdx+"-toldo-control"):undefined}/>
          </div>
        </div>
      )}

      <div style={S.divider}/>
      <div style={{...S.chk,marginBottom:8}} onClick={function(){update("incluyeInstalacion",!p.incluyeInstalacion);}}>
        <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.incluyeInstalacion?C.gold:C.border}`,background:p.incluyeInstalacion?"rgba(184,150,90,.3)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {p.incluyeInstalacion&&<span style={{color:C.goldL,fontSize:12,fontWeight:900}}>✓</span>}
        </div>
        <span style={{fontSize:12,fontWeight:600,color:p.incluyeInstalacion?C.goldL:"#aaa"}}>Incluye Instalación</span>
      </div>
      {p.incluyeInstalacion&&(
        <div style={{...S.field,marginBottom:14}}>
          <div style={S.lbl}>Precio Instalación — editable</div>
          <input type="number" style={S.inp} value={p.instalacionPrecio??instBase}
            onChange={function(e){update("instalacionPrecio",e.target.value===""?"":e.target.value);}}
            onBlur={function(e){const v=parseFloat(e.target.value);update("instalacionPrecio",isNaN(v)?instBase:v);}}/>
          <div style={S.tip}>Base: {fmt(instBase)}{motorized?" · motorizado":""}</div>
        </div>
      )}

      {altoDoble&&isToldo&&(
        <div style={{...S.infoRow,marginBottom:14}}>
          ℹ️ Alto &gt; 350cm — se recomienda considerar uso de andamio
        </div>
      )}

      {calc&&!calc.noDisponible&&(
        <div style={{...S.priceBox,marginTop:16}}>
          {(parseInt(p.cantidad)||1)>1&&<div style={{...S.priceRow,color:C.gold,fontWeight:700}}><span>Precio × 1 unidad</span><span>{fmt(calc.subtotal)}</span></div>}
          {(parseInt(p.cantidad)||1)>1&&<div style={S.priceRow}><span>Cantidad</span><span>× {calc.cantidad}</span></div>}
          <div style={S.priceRow}><span>Precio lista</span><span>{fmt(calc.base)}</span></div>
          <div style={S.priceRow}><span>Precio con descuento (× {calc.mult})</span><span>{fmt(calc.ajustado)}</span></div>
          {p.incluyeInstalacion&&<div style={S.priceRow}><span>Instalación</span><span>{fmt(calc.instPrecio)}</span></div>}
          {calc.motorPrecio>0&&<div style={S.priceRow}><span>Motor</span><span>{fmt(calc.motorPrecio)}</span></div>}
          {calc.controlPrecio>0&&<div style={S.priceRow}><span>Control</span><span>{fmt(calc.controlPrecio)}</span></div>}
          <div style={S.totalRow}><span>TOTAL {(parseInt(p.cantidad)||1)>1?"("+calc.cantidad+" uds)":"UNIDAD"}</span><span>{fmt(calc.total)}</span></div>
        </div>
      )}
    </>
  );
}

// ─── PIECE CARD ────────────────────────────────────────────────────────────────


// ─── SIMPLE EXTRAS (custom only, for Papel and Otro) ─────────────────────────
function SimpleExtras({extras, onChange}) {
  if (!extras) extras = [];
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState("1");

  function handleAdd() {
    if (!nombre || !precio) return;
    onChange([...extras, {
      id: uid(),
      nombre: nombre,
      precio: parseFloat(precio) || 0,
      cantidad: parseInt(cantidad) || 1,
    }]);
    setNombre(""); setPrecio(""); setCantidad("1");
  }

  function removeExtra(id) { onChange(extras.filter(function(e){ return e.id !== id; })); }
  function updateExtra(id, key, val) {
    onChange(extras.map(function(e){ return e.id === id ? {...e, [key]: val} : e; }));
  }

  return (
    <div style={{marginTop:4}}>
      <div style={{...S.lbl, marginBottom:12, color:C.goldL}}>➕ Servicios y Extras</div>
      {extras.map(function(e) {
        return (
          <div key={e.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap",padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:8}}>
            <input style={{...S.inp,flex:2,minWidth:130}} value={e.nombre}
              onChange={function(ev){updateExtra(e.id,"nombre",ev.target.value);}}/>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:"#aaa",fontSize:11}}>$</span>
              <input type="number" style={{...S.inp,width:90}} value={e.precio}
                onChange={function(ev){updateExtra(e.id,"precio",ev.target.value===""?"":ev.target.value);}}
                onBlur={function(ev){const v=parseFloat(ev.target.value);updateExtra(e.id,"precio",isNaN(v)?0:v);}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{color:"#aaa",fontSize:11}}>×</span>
              <input type="number" min="1" style={{...S.inp,width:60}} value={e.cantidad}
                onChange={function(ev){updateExtra(e.id,"cantidad",ev.target.value===""?"":ev.target.value);}}
                onBlur={function(ev){const v=parseInt(ev.target.value);updateExtra(e.id,"cantidad",isNaN(v)||v<1?1:v);}}/>
            </div>
            <span style={{color:C.goldL,fontSize:12,fontWeight:700,minWidth:64,textAlign:"right"}}>
              {fmt((parseFloat(e.precio)||0)*(parseInt(e.cantidad)||1))}
            </span>
            <button style={S.removeBtn} onClick={function(){removeExtra(e.id);}}>✕</button>
          </div>
        );
      })}
      <div style={{background:"rgba(201,168,76,.04)",border:"1px dashed #2a2a2a",borderRadius:8,padding:"10px 12px",marginTop:6}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input style={{...S.inp,flex:2,minWidth:130}} placeholder="Descripción del servicio/extra" value={nombre}
            onChange={function(e){setNombre(e.target.value);}}/>
          <input type="number" style={{...S.inp,width:100}} placeholder="Precio $" value={precio}
            onChange={function(e){setPrecio(e.target.value);}}/>
          <input type="number" min="1" style={{...S.inp,width:70}} placeholder="Cant." value={cantidad}
            onChange={function(e){setCantidad(e.target.value);}}/>
          <div style={{...S.radio(true),cursor:"pointer",padding:"7px 16px"}} onClick={handleAdd}>+ Agregar</div>
        </div>
      </div>
    </div>
  );
}

// ─── PAPEL DE PARED FORM ──────────────────────────────────────────────────────
function PapelForm({p, update, errors}) {
  if(!errors) errors = {};
  function updatePared(id, key, val) {
    const paredes = (p.papelParedes||[]).map(function(pw) {
      return pw.id === id ? {...pw, [key]: val} : pw;
    });
    update("papelParedes", paredes);
  }
  function addPared() {
    update("papelParedes", [...(p.papelParedes||[]), {id:uid(), nombre:"", ancho:"", alto:""}]);
  }
  function removePared(id) {
    update("papelParedes", (p.papelParedes||[]).filter(function(pw){return pw.id!==id;}));
  }

  const calcR = p.papelModo==="ROLLO" ? calcPapelRollos(p) : null;
  const calcY = p.papelModo==="YARDA" ? calcPapelYardas(p) : null;
  const total = calcPapelTotal(p);
  const precio = parseFloat(p.papelPrecioUnit)||0;
  const cantCalculada = p.papelModo==="ROLLO"
    ? (calcR ? calcR.totalConDesperdicio : 0)
    : (calcY ? calcY.totalFinal : 0);
  const cantFinal = p.papelUsarCalculadora ? cantCalculada : (parseFloat(p.papelCantidadManual)||0);
  const unidad = p.papelModo==="ROLLO" ? "rollos" : "yardas";

  return (
    <>
      {/* Modo selector */}
      <div style={{...S.field, marginBottom:16}}>
        <div style={S.lbl}>Modo de Cálculo</div>
        <div style={S.radioRow}>
          {["ROLLO","YARDA"].map(function(m){
            return <div key={m} style={S.radio(p.papelModo===m)} onClick={function(){update("papelModo",m);}}>
              Por {m==="ROLLO"?"Rollo":"Yarda"}
            </div>;
          })}
        </div>
      </div>

      {/* Usar calculadora toggle */}
      <div style={{...S.chk, marginBottom:16}} onClick={function(){update("papelUsarCalculadora",!p.papelUsarCalculadora);}}>
        <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.papelUsarCalculadora?C.gold:C.border}`,background:p.papelUsarCalculadora?"rgba(184,150,90,.3)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {p.papelUsarCalculadora&&<span style={{color:C.goldL,fontSize:12,fontWeight:900}}>✓</span>}
        </div>
        <span style={{fontSize:12,fontWeight:600,color:p.papelUsarCalculadora?C.goldL:"#aaa"}}>Usar calculadora de material</span>
      </div>

      {/* Calculadora */}
      {p.papelUsarCalculadora && (
        <div style={{background:"rgba(184,150,90,.04)",border:"1px solid rgba(184,150,90,.12)",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{...S.lbl,marginBottom:12,color:C.goldL}}>📐 Calculadora de Material</div>

          {/* Datos del rollo/material */}
          <div style={{...S.g2,marginBottom:12}}>
            <div style={S.field}>
              <div style={{...S.lbl,color:errors.papelAnchoRollo?"#E05555":"#ccc"}}>Ancho del rollo/material (m) {errors.papelAnchoRollo&&<span style={{color:"#E05555"}}>*</span>}</div>
              <input type="number" step="0.01" style={{...S.inp,borderColor:errors.papelAnchoRollo?"#E05555":undefined}} placeholder="ej. 0.53" value={p.papelAnchoRollo}
                onChange={function(e){update("papelAnchoRollo",e.target.value);}}/>
              {errors.papelAnchoRollo&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.papelAnchoRollo}</div>}
            </div>
            {p.papelModo==="ROLLO" && (
              <div style={S.field}>
                <div style={{...S.lbl,color:errors.papelLargoRollo?"#E05555":"#ccc"}}>Largo del rollo (m) {errors.papelLargoRollo&&<span style={{color:"#E05555"}}>*</span>}</div>
                <input type="number" step="0.01" style={{...S.inp,borderColor:errors.papelLargoRollo?"#E05555":undefined}} placeholder="ej. 10" value={p.papelLargoRollo}
                  onChange={function(e){update("papelLargoRollo",e.target.value);}}/>
                {errors.papelLargoRollo&&<div style={{fontSize:10,color:"#E05555",marginTop:2}}>⚠ {errors.papelLargoRollo}</div>}
              </div>
            )}
            {p.papelModo==="ROLLO" && (
              <div style={S.field}>
                <div style={S.lbl}>Repetición de patrón (m) — opcional</div>
                <input type="number" step="0.01" style={S.inp} placeholder="ej. 0.64 (0 si no hay)" value={p.papelRepeticion}
                  onChange={function(e){update("papelRepeticion",e.target.value);}}/>
              </div>
            )}
          </div>

          {/* Paredes */}
          <div style={{...S.lbl,marginBottom:8,color:"#bbb"}}>Paredes a cubrir</div>
          {(p.papelParedes||[]).map(function(pw, i){
            return (
              <div key={pw.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap",padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:8}}>
                <input style={{...S.inp,flex:2,minWidth:120}} placeholder={"Pared "+(i+1)+" (nombre opcional)"} value={pw.nombre}
                  onChange={function(e){updatePared(pw.id,"nombre",e.target.value);}}/>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:errors.papelParedes&&!pw.ancho?"#E05555":"#aaa",fontSize:11}}>Ancho (m){errors.papelParedes&&!pw.ancho?" *":""}</span>
                  <input type="number" step="0.01" style={{...S.inp,width:90,borderColor:errors.papelParedes&&!pw.ancho?"#E05555":undefined}} placeholder="ej. 3.5" value={pw.ancho}
                    onChange={function(e){updatePared(pw.id,"ancho",e.target.value);}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:errors.papelParedes&&!pw.alto?"#E05555":"#aaa",fontSize:11}}>Alto (m){errors.papelParedes&&!pw.alto?" *":""}</span>
                  <input type="number" step="0.01" style={{...S.inp,width:90,borderColor:errors.papelParedes&&!pw.alto?"#E05555":undefined}} placeholder="ej. 2.4" value={pw.alto}
                    onChange={function(e){updatePared(pw.id,"alto",e.target.value);}}/>
                </div>
                {(p.papelParedes||[]).length>1&&<button style={S.removeBtn} onClick={function(){removePared(pw.id);}}>✕</button>}
              </div>
            );
          })}
          <div style={S.addBtn} onClick={addPared}>+ Agregar pared</div>
          {errors.papelParedes&&<div style={{fontSize:10,color:"#E05555",marginTop:6}}>⚠ {errors.papelParedes}</div>}

          {/* Resultado calculadora */}
          {p.papelModo==="ROLLO" && calcR && (
            <div style={{marginTop:12,padding:"10px 14px",background:"rgba(76,175,125,.06)",border:"1px solid rgba(76,175,125,.15)",borderRadius:8}}>
              <div style={{fontSize:11,color:"#4CAF7D",fontWeight:700,marginBottom:4}}>Resultado del cálculo:</div>
              {calcR.detalle.filter(function(d){return !d.skip;}).map(function(d,i){
                return <div key={i} style={{fontSize:10,color:"#aaa",marginBottom:2}}>
                  {d.nombre||"Pared "+(i+1)}: {d.tirasPared} tiras / {d.tirasPorRollo} tiras por rollo = <strong style={{color:"#fff"}}>{d.rollosPared} rollo{d.rollosPared!==1?"s":""}</strong>
                </div>;
              })}
              <div style={{fontSize:12,color:"#4CAF7D",fontWeight:700,marginTop:6}}>
                Total: {calcR.totalRollos} rollos + 10% desperdicio = <strong>{calcR.totalConDesperdicio} rollos</strong>
              </div>
            </div>
          )}
          {p.papelModo==="YARDA" && calcY && (
            <div style={{marginTop:12,padding:"10px 14px",background:"rgba(76,175,125,.06)",border:"1px solid rgba(76,175,125,.15)",borderRadius:8}}>
              <div style={{fontSize:11,color:"#4CAF7D",fontWeight:700,marginBottom:4}}>Resultado del cálculo:</div>
              {calcY.detalle.filter(function(d){return !d.skip;}).map(function(d,i){
                return <div key={i} style={{fontSize:10,color:"#aaa",marginBottom:2}}>
                  {d.nombre||"Pared "+(i+1)}: X={d.X} × A={d.A.toFixed(2)} = <strong style={{color:"#fff"}}>{d.yardas.toFixed(2)} yds</strong>
                </div>;
              })}
              <div style={{fontSize:12,color:"#4CAF7D",fontWeight:700,marginTop:6}}>
                Total redondeado: <strong>{calcY.totalFinal} yardas</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sin calculadora: descripción, cantidad, precio */}
      {!p.papelUsarCalculadora && (
        <>
          <div style={{...S.field,marginBottom:14}}>
            <div style={S.lbl}>Descripción</div>
            <input style={S.inp}
              placeholder={p.papelModo==="ROLLO"?"Papel de pared por rollo":"Papel de pared por yarda"}
              value={p.papelDescripcion||""}
              onChange={function(e){update("papelDescripcion",e.target.value);}}/>
          </div>
          <div style={{...S.g2,marginBottom:16}}>
            <div style={S.field}>
              <div style={S.lbl}>Cantidad</div>
              <input type="number" step="0.01" style={S.inp}
                placeholder={p.papelModo==="ROLLO"?"Nº de rollos":"Nº de yardas"}
                value={p.papelCantidadManual}
                onChange={function(e){update("papelCantidadManual",e.target.value);}}/>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Precio por {unidad} ($)</div>
              <input type="number" step="0.01" style={S.inp} placeholder="Precio unitario" value={p.papelPrecioUnit}
                onChange={function(e){update("papelPrecioUnit",e.target.value);}}/>
            </div>
          </div>
        </>
      )}

      {/* Con calculadora: solo precio */}
      {p.papelUsarCalculadora && (
        <>
          <div style={S.divider}/>
          <div style={{...S.g2,marginBottom:16}}>
            <div style={S.field}>
              <div style={S.lbl}>Precio por {unidad} ($)</div>
              <input type="number" step="0.01" style={S.inp} placeholder="Precio unitario" value={p.papelPrecioUnit}
                onChange={function(e){update("papelPrecioUnit",e.target.value);}}/>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Cantidad final</div>
              <input style={{...S.inp,color:C.goldL,fontWeight:700}} readOnly value={cantFinal>0?cantFinal+" "+unidad:"—"}/>
            </div>
          </div>
        </>
      )}

      {/* Servicios adicionales manuales */}
      <div style={S.divider}/>
      <SimpleExtras extras={p.papelServicios||[]} onChange={function(v){update("papelServicios",v);}}/>

      {/* Price box */}
      {(precio>0||cantFinal>0) && (
        <div style={{...S.priceBox,marginTop:16}}>
          <div style={S.priceRow}><span>Cantidad: {cantFinal} {unidad} × {fmt(precio)}</span><span>{fmt(total)}</span></div>
          {(p.papelServicios||[]).map(function(e){
            const pr=parseFloat(e.precio)||0;
            const q=e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
            return <div key={e.id} style={S.priceRow}><span>{e.nombre}</span><span>{fmt(pr*q)}</span></div>;
          })}
          <div style={S.totalRow}><span>TOTAL PAPEL DE PARED</span><span>{fmt(calcPapelTotal(p)+extrasTotal(p.papelServicios||[]))}</span></div>
        </div>
      )}
    </>
  );
}

// ─── OTRO FORM ────────────────────────────────────────────────────────────────
function OtroForm({p, update}) {
  const total = calcOtroTotal(p);
  const precio = parseFloat(p.otroPrecioUnit)||0;
  const cantidad = parseInt(p.otroCantidad)||1;

  return (
    <>
      <div style={{...S.field,marginBottom:14}}>
        <div style={S.lbl}>Descripción del producto / servicio</div>
        <input style={S.inp} placeholder="Descripción" value={p.otroDescripcion||""}
          onChange={function(e){update("otroDescripcion",e.target.value);}}/>
      </div>
      <div style={{...S.g2,marginBottom:14}}>
        <div style={S.field}>
          <div style={S.lbl}>Cantidad</div>
          <input type="number" min="1" style={S.inp}
            defaultValue={p.otroCantidad||1}
            key={"cant-"+p.id}
            onBlur={function(e){const v=parseInt(e.target.value);update("otroCantidad",isNaN(v)||v<1?1:v);}}/>
        </div>
        <div style={S.field}>
          <div style={S.lbl}>Precio unitario ($)</div>
          <input type="number" step="0.01" style={S.inp} placeholder="0.00" value={p.otroPrecioUnit||""}
            onChange={function(e){update("otroPrecioUnit",e.target.value);}}/>
        </div>
      </div>
      {precio>0 && (
        <div style={S.priceBox}>
          <div style={S.priceRow}><span>Precio lista (× 1.40)</span><span>{fmt(precio*1.40*cantidad)}</span></div>
          <div style={S.priceRow}><span>Precio con descuento</span><span>{fmt(precio*cantidad)}</span></div>
          <div style={S.totalRow}><span>TOTAL</span><span>{fmt(total)}</span></div>
        </div>
      )}
    </>
  );
}

function PieceCard({p,idx,onChange,onRemove,telas,setTelas,confecciones,setConfecciones,rielesCustom,setRielesCustom,motoresCustom,setMotoresCustom,controlesCustom,setControlesCustom,cenefasCustom,setCenefasCustom,makePendingHandler}){
  function stripTemp(obj){const{_motoresCustom,_controlesCustom,_cenefasCustom,...rest}=obj;return rest;}
  function update(k,v){onChange(stripTemp({...p,[k]:v}));}
  function updateMany(obj){onChange(stripTemp({...p,...obj}));}
  function cloneAction(){
    const clon = stripTemp({...p, id:uid(), area: p.area});
    onChange(clon, "clone");
  }
  const isPersiana=p.tipoProducto==="PERSIANA";
  const isCortina=p.tipoProducto==="CORTINA DE TELA";
  const isToldo=p.tipoProducto==="TOLDO VERTICAL";
  const isPergola=p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE";
  const isPapel=p.tipoProducto==="PAPEL DE PARED";
  const isOtro=p.tipoProducto==="OTRO";
  let badgeTotal=0;
  if(isPersiana){const c=calcPersianaTotal(p);badgeTotal=c?c.total:0;}
  else if(isCortina&&p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto){badgeTotal=calcCortinaTotal(p,telas||[],confecciones||[],rielesCustom||[]).total*(parseInt(p.cantidad)||1);}
  else if(isToldo||isPergola){const c=calcToldoTotal(p);badgeTotal=(c&&!c.noDisponible)?c.total:0;}
  else if(isPapel){badgeTotal=calcPapelTotal(p)+extrasTotal(p.papelServicios||[]);}
  else if(isOtro){badgeTotal=calcOtroTotal(p);}

  const borderColor=isPersiana?"rgba(201,168,76,.3)":isCortina?"rgba(100,200,180,.3)":(isToldo||isPergola)?"rgba(80,160,220,.3)":isPapel?"rgba(130,100,220,.3)":"rgba(180,180,180,.2)";

  return(
    <div style={{...S.card,borderColor:borderColor}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {(function(){const img=getProductImage(p,null);return img?<img src={img} style={{width:48,height:36,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:null;})()}
          <span style={{fontSize:14,fontWeight:800,color:C.gold}}>Pieza #{idx+1}</span>
          {p.area&&<span style={S.badge(C.muted)}>{p.area}</span>}
          {isPersiana&&(parseFloat(p.alto)||0)>350&&<span style={S.badge("#ff9944")}>DOBLE ALTURA</span>}
          {badgeTotal>0&&<span style={S.badge(C.green)}>{fmt(badgeTotal)}{isPersiana&&(parseInt(p.cantidad)||1)>1?" (×"+p.cantidad+")":""}</span>}
          {!isPieceValid(p,telas)&&<span style={S.badge("#E05555")}>⚠ Campos incompletos</span>}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <button style={{...S.removeBtn,color:"#88aaff",borderColor:"rgba(136,170,255,.3)",whiteSpace:"nowrap"}} onClick={cloneAction}>⧉ Duplicar Pieza</button>
          <button style={{...S.removeBtn,whiteSpace:"nowrap"}} onClick={onRemove}>✕ Eliminar</button>
        </div>
      </div>
      <div style={{...S.g2,marginBottom:14}}>
        <div style={S.field}><div style={S.lbl}>Área / Ubicación</div><input style={S.inp} placeholder="ej. Sala principal" value={p.area} onChange={function(e){update("area",e.target.value);}}/></div>
        <div style={S.field}>
          <div style={S.lbl}>Tipo de Producto</div>
          <div style={S.radioRow}>
            {["PERSIANA","CORTINA DE TELA","TOLDO VERTICAL","PÉRGOLA BRAZO EXTENSIBLE","PAPEL DE PARED","OTRO"].map(function(t){
              return <div key={t} style={{...S.radio(p.tipoProducto===t),fontSize:10}} onClick={function(){update("tipoProducto",t);}}>{t}</div>;
            })}
          </div>
        </div>
      </div>
      {(function(){
        const errs=validatePiece(p,telas);
        if(isPersiana) return <PersianaForm p={p} update={update} updateMany={updateMany} motoresCustom={motoresCustom} setMotoresCustom={setMotoresCustom} controlesCustom={controlesCustom} setControlesCustom={setControlesCustom} cenefasCustom={cenefasCustom} setCenefasCustom={setCenefasCustom} makePendingHandler={makePendingHandler} pieceIdx={idx} errors={errs}/>;
        if(isCortina) return <CortinaForm p={p} update={update} updateMany={updateMany} telas={telas} setTelas={setTelas} confecciones={confecciones} setConfecciones={setConfecciones} rielesCustom={rielesCustom} setRielesCustom={setRielesCustom} controlesCustom={controlesCustom} setControlesCustom={setControlesCustom} makePendingHandler={makePendingHandler} pieceIdx={idx} errors={errs}/>;
        if(isToldo||isPergola) return <ToldoForm p={p} update={update} updateMany={updateMany} motoresCustom={motoresCustom} setMotoresCustom={setMotoresCustom} controlesCustom={controlesCustom} setControlesCustom={setControlesCustom} makePendingHandler={makePendingHandler} pieceIdx={idx}/>;
        if(isPapel) return <PapelForm p={p} update={update} errors={errs}/>;
        if(isOtro) return <OtroForm p={p} update={update}/>;
        return null;
      })()}
    </div>
  );
}

// ─── PDF ────────────────────────────────────────────────────────────────────────
const VIVENDI_TERMS = `<div style="font-size:9.5px;color:#222;line-height:1.7;width:100%">
<div style="font-weight:800;font-size:11px;margin-bottom:8px;text-align:center;letter-spacing:1px">VIVENDI DECOR — TÉRMINOS Y CONDICIONES COMERCIALES</div>
<p style="margin-bottom:4px;font-style:italic">Inversiones USA Express Now</p>

<p style="font-weight:700;margin:6px 0 3px">1. SUMINISTRO DE PAPELES DE PARED</p>
<p>Todos los papeles de pared se trabajan exclusivamente bajo pedido especial, según selección, aprobación y confirmación del cliente. Debido a que se trata de productos importados y/o personalizados: No se aceptan devoluciones ni cambios una vez confirmado el pedido. El cliente debe validar previamente diseño, color, textura, medidas y cantidades. Puede existir ligera variación de tono entre muestras y producto final. Los tiempos de entrega pueden variar según disponibilidad, importación y logística. El pedido se procesa únicamente con el pago completo.</p>

<p style="font-weight:700;margin:6px 0 3px">2. SUMINISTRO DE ALFOMBRAS</p>
<p>Las alfombras se cotizan y suministran bajo pedido específico según medidas, modelo, textura, color y especificaciones aprobadas. No se aceptan devoluciones ni cancelaciones luego de aprobado el pedido. Puede existir variación mínima de tono entre muestras y producto final. La producción y entrega dependen de disponibilidad de fábrica y tiempos de importación. El pedido se procesa únicamente con el pago completo.</p>

<p style="font-weight:700;margin:6px 0 3px">3. INSTALACIÓN DE PAPEL DE PARED</p>
<p>El área debe estar completamente lista: paredes secas, niveladas, limpias, selladas y libres de humedad. No incluye albañilería, gypsum, resane, pintura ni preparación de paredes. Si durante la instalación se detectan condiciones no aptas, el trabajo podrá ser suspendido. No nos hacemos responsables por desprendimientos ocasionados por humedad, filtraciones, pintura defectuosa o malas condiciones estructurales.</p>

<p style="font-weight:700;margin:6px 0 3px">4. INSTALACIÓN DE ALFOMBRAS</p>
<p>El área debe estar libre, limpia y lista. No incluye remoción de materiales existentes salvo cotización adicional. No incluye nivelación de pisos ni trabajos civiles. Cualquier trabajo extraordinario detectado será cotizado aparte.</p>

<p style="font-weight:700;margin:6px 0 3px">5. COJINERÍA Y TAPIZADO</p>
<p>Se requiere aprobación previa de telas, medidas, densidades y acabados. No se aceptan devoluciones una vez iniciado el proceso. Los tiempos de entrega pueden variar según disponibilidad y complejidad. En trabajos sobre muebles existentes, no nos hacemos responsables por daños estructurales previos, madera deteriorada u oxidación interna.</p>

<p style="font-weight:700;margin:6px 0 3px">6. CONDICIONES DE PAGO</p>
<p>Se requiere el pago del 100% del valor total cotizado para procesar cualquier pedido. No se procesarán pedidos, reservas ni programación de instalación sin pago total confirmado. Los pagos realizados no son reembolsables una vez iniciado el proceso.</p>

<p style="font-weight:700;margin:6px 0 3px">7. VISITAS TÉCNICAS Y MEDICIONES</p>
<p>Las medidas suministradas por el cliente son responsabilidad directa del mismo. VIVENDI DECOR no se responsabiliza por errores derivados de medidas incorrectas suministradas por el cliente.</p>

<p style="font-weight:700;margin:6px 0 3px">8. GARANTÍA</p>
<p>Cubre exclusivamente defectos de instalación atribuibles a mano de obra de nuestro equipo. No cubre: humedad, filtraciones, mal uso, golpes, accidentes, manipulación por terceros, deterioro natural, daños estructurales preexistentes ni desgaste normal. No aplica sobre materiales instalados por terceros.</p>

<p style="font-weight:700;margin:6px 0 3px">9. ACEPTACIÓN</p>
<p>La confirmación del pedido, pago total o aceptación de cotización implica aceptación total de las presentes condiciones comerciales.</p>

<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div><div style="border-bottom:1px solid #666;margin-bottom:4px;height:28px"></div><div style="font-size:9px;color:#444">Firma del Cliente</div></div>
  <div><div style="border-bottom:1px solid #666;margin-bottom:4px;height:28px"></div><div style="font-size:9px;color:#444">Nombre Completo</div></div>
</div>
<div style="margin-top:12px"><span style="font-size:9px;color:#444">Fecha: _____ / _____ / _______</span></div>
</div>`;

const TERMS = `<div style="font-size:9.5px;color:#222;line-height:1.7;width:100%">
<div style="font-weight:800;font-size:11px;margin-bottom:12px;text-align:center;letter-spacing:1px">THE BLIND CONCEPT — TÉRMINOS Y CONDICIONES DE VENTA E INSTALACIÓN</div>

<div style="margin-bottom:14px;padding:12px 14px;background:#f5f5f5;border-radius:4px">
  <p style="font-weight:800;font-size:10.5px;margin-bottom:6px">CONDICIONES DE PAGO</p>
  <p style="font-weight:700;margin-bottom:4px">Se requiere un abono inicial del 70% para iniciar la fabricación.</p>
  <p style="font-weight:700;margin-bottom:8px">El 30% restante deberá estar cancelado antes o el día de la instalación, previo al inicio de los trabajos.</p>
  <p style="font-weight:800;margin-bottom:2px">Datos para transferencia:</p>
  <p style="font-weight:700">ACH BANCO GENERAL &nbsp;|&nbsp; CUENTA CORRIENTE 03-97-01-148141-4 &nbsp;|&nbsp; VIVENDI DECOR</p>
</div>

<p style="margin-bottom:6px">Al firmar este documento o realizar el pago del abono, el cliente autoriza a THE BLIND CONCEPT (TBC) a fabricar, suministrar e instalar los productos detallados en la cotización y acepta los siguientes términos y condiciones.</p>

<p style="font-weight:700;margin:6px 0 3px">1. Condiciones Generales</p>
<p>Todos los productos son fabricados a la medida y personalizados según las especificaciones aprobadas por el cliente. Por esta razón, no se aceptan devoluciones, cambios ni cancelaciones una vez confirmado el pedido. TBC no se hace responsable por variaciones menores en medidas, tonalidades, textura, alineación o caída de telas propias de productos fabricados a medida. Las medidas pueden presentar tolerancias aproximadas de ±1/8" hasta ±5/8" dependiendo del producto y sistema instalado. La desinstalación de persianas, cortinas o estructuras existentes no está incluida salvo que se especifique por escrito en la cotización. Si las medidas son suministradas por el cliente, TBC no será responsable por errores de fabricación derivados de medidas incorrectas. Las imágenes, muestras y catálogos son referenciales y pueden existir ligeras variaciones de color o textura entre muestras y producto final debido a lotes de fabricación e iluminación.</p>

<p style="font-weight:700;margin:6px 0 3px">2. Tiempos de Entrega e Instalación</p>
<p>Los tiempos de entrega e instalación son estimados y pueden variar por disponibilidad de materiales, importaciones, retrasos logísticos, condiciones climáticas o situaciones fuera del control de TBC. TBC no será responsable por retrasos ocasionados por terceros, proveedores, aduanas, edificios, PH, restricciones de acceso o causas de fuerza mayor. En caso de que el cliente solicite reprogramar la instalación luego de confirmado el pedido o una vez coordinada la visita, TBC podrá aplicar cargos adicionales.</p>

<p style="font-weight:700;margin:6px 0 3px">3. Garantía</p>
<p>Los productos cuentan con garantía limitada de 3 años a partir de la fecha de instalación. La garantía cubre únicamente defectos de fabricación y/o errores de instalación realizados por TBC. La garantía no cubre: daños por mal uso, golpes, accidentes, manipulación por terceros, humedad, filtraciones, exposición salina o corrosión, desgaste natural, mascotas, niños, limpieza inadecuada, variaciones normales del producto, fallas eléctricas, motores sin protector de voltaje, ni daños causados por fluctuaciones eléctricas. La garantía quedará anulada si el producto es modificado, reparado o intervenido por terceros ajenos a TBC. TBC se reserva el derecho de reparar o reemplazar parcial o totalmente la pieza defectuosa según criterio técnico. La garantía no incluye visitas de mantenimiento, limpieza o ajustes menores por uso normal.</p>

<p style="font-weight:700;margin:6px 0 3px">4. Responsabilidad</p>
<p>TBC no será responsable por daños en tuberías, cables eléctricos, estructuras ocultas, gypsum, mármol, madera, marcos defectuosos o cualquier elemento no visible previo a la instalación. El cliente es responsable de informar previamente sobre tuberías, cableado oculto, refuerzos especiales o condiciones estructurales relevantes. Las instalaciones motorizadas incluyen únicamente conexión básica del motor y no incluyen trabajos eléctricos, canaletas, molduras, pintura, gypsum, resanes o cableado adicional salvo especificación escrita. TBC no será responsable por daños indirectos, lucro cesante, pérdidas comerciales o afectaciones derivadas del uso o imposibilidad de uso del producto.</p>

<p style="font-weight:700;margin:6px 0 3px">5. Obligaciones del Cliente</p>
<p>El cliente deberá garantizar acceso al área de trabajo, coordinar permisos de entrada, asegurar disponibilidad de estacionamiento si aplica, proteger muebles u objetos delicados, y estar presente o dejar una persona autorizada durante la instalación. Si la instalación no puede realizarse por causas atribuibles al cliente, podrá generarse un cargo adicional por nueva visita. Las instalaciones fuera de la Ciudad de Panamá podrán generar costos adicionales por transporte, hospedaje y viáticos.</p>

<p style="font-weight:700;margin:6px 0 3px">6. Aceptación de Instalación</p>
<p>Una vez finalizada la instalación y aprobado el trabajo por el cliente o su representante, se entenderá como entrega conforme. Cualquier observación deberá ser notificada dentro de las primeras 48 horas posteriores a la instalación. Todo abono realizado se considera aceptación expresa de estos términos y condiciones, aun sin firma física del documento.</p>

<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
  <div>
    <div style="border-bottom:1px solid #666;margin-bottom:4px;height:28px"></div>
    <div style="font-size:9px;color:#444">Firma del Cliente</div>
  </div>
  <div>
    <div style="border-bottom:1px solid #666;margin-bottom:4px;height:28px"></div>
    <div style="font-size:9px;color:#444">Nombre Completo</div>
  </div>
</div>
<div style="margin-top:12px"><span style="font-size:9px;color:#444">Fecha: _____ / _____ / _______</span></div>
</div>`;

const LOGO_SVG = `<svg width="220" height="90" viewBox="0 0 440 158" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="116" height="154" rx="1.5" stroke="#111" stroke-width="3.5" fill="none"/>
  <line x1="30" y1="2" x2="30" y2="156" stroke="#111" stroke-width="3"/>
  <line x1="52" y1="2" x2="52" y2="156" stroke="#111" stroke-width="3"/>
  <line x1="74" y1="2" x2="74" y2="156" stroke="#111" stroke-width="3"/>
  <line x1="74" y1="28" x2="118" y2="28" stroke="#111" stroke-width="2.5"/>
  <line x1="74" y1="48" x2="118" y2="48" stroke="#111" stroke-width="2.5"/>
  <line x1="74" y1="68" x2="118" y2="68" stroke="#111" stroke-width="2.5"/>
  <line x1="74" y1="88" x2="118" y2="88" stroke="#111" stroke-width="2.5"/>
  <line x1="74" y1="108" x2="118" y2="108" stroke="#111" stroke-width="2.5"/>
  <line x1="74" y1="128" x2="118" y2="128" stroke="#111" stroke-width="2.5"/>
  <text x="138" y="52" font-family="Georgia,'Times New Roman',serif" font-size="48" font-weight="400" fill="#111">The</text>
  <text x="138" y="106" font-family="Georgia,'Times New Roman',serif" font-size="48" font-weight="400" fill="#111">Blind</text>
  <text x="138" y="154" font-family="Georgia,'Times New Roman',serif" font-size="48" font-weight="400" fill="#111">Concept</text>
</svg>`;

function generarNumCotizacion(empresa){
  const fechaISO=new Date().toISOString().slice(0,10).replace(/-/g,"");
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand=Array.from({length:4},function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  return (empresa==="VIVENDI"?"VIV":"TBC")+"-"+fechaISO+"-"+rand;
}

function buildPDF(cliente,pieces,telas,confecciones,viatico,itbms,globalExtras,empresa,descuento,rielesCustom,comentarios,stateBlob,numCotizacion){
  const fecha=new Date().toLocaleDateString("es-CR");
  if(!numCotizacion)numCotizacion=generarNumCotizacion(empresa);
  const f=(n)=>"$"+(Number(n||0).toFixed(2));
  const hayPapelOOtro=pieces.some(function(p){return p.tipoProducto==="PAPEL DE PARED"||p.tipoProducto==="OTRO";});
  const persianasYCortinas=pieces.filter(function(p){return p.tipoProducto==="PERSIANA"||p.tipoProducto==="CORTINA DE TELA"||p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE";});
  const todasConInstalacion=persianasYCortinas.length>0&&persianasYCortinas.every(function(p){return p.incluyeInstalacion;});
  const allHaveInstall=todasConInstalacion;
  const instalacionMsg=todasConInstalacion?(hayPapelOOtro?"✓ INSTALACIÓN GRATIS EN PERSIANAS Y CORTINAS":"✓ INSTALACIÓN GRATIS"):null;

  if(!globalExtras)globalExtras=[];
  const rows=pieces.map(function(p,i){
    const isPersiana=p.tipoProducto==="PERSIANA";
    const isCortina=p.tipoProducto==="CORTINA DE TELA";
    const isToldoPDF=p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE";
    const isPapel=p.tipoProducto==="PAPEL DE PARED";
    const isOtro=p.tipoProducto==="OTRO";
    let precioLista=0,precioDesc=0,total=0;
    const desc=buildDesc(p,telas,confecciones,rielesCustom||[]);
    const qty=parseInt(p.cantidad)||1;
    if(isPersiana){
      const c=calcPersianaTotal(p);
      if(!c){
        // Show persiana row without price if incomplete
        return `<tr style="border-bottom:1px solid #e8e8e8">
          <td style="padding:10px 8px;vertical-align:middle"><div style="width:80px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999">Persiana</div></td>
          <td style="padding:10px 8px;font-weight:600;text-align:center;vertical-align:middle">${p.area||"—"}</td>
          <td style="padding:10px 8px;text-align:center;vertical-align:middle">${qty}</td>
          <td style="padding:10px 8px;font-size:10px;vertical-align:middle">${p.tipoPersiana||"Sin tipo"}</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
        </tr>`;
      }
      precioLista=c.subtotal*1.40;    // precio lista = precio con descuento × 1.40
      precioDesc=c.subtotal;          // precio descuento por 1 pieza (ajustado + motor + control + cenefa + etc)
      total=c.total;                  // total = subtotal × cantidad
    } else if(isCortina){
      if(!p.telaId||!p.confeccionId||!p.rielId||!p.ancho||!p.alto){
        return `<tr style="border-bottom:1px solid #e8e8e8">
          <td style="padding:10px 8px;vertical-align:middle"><div style="width:80px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999">Cortina</div></td>
          <td style="padding:10px 8px;font-weight:600;text-align:center;vertical-align:middle">${p.area||"—"}</td>
          <td style="padding:10px 8px;text-align:center;vertical-align:middle">${qty}</td>
          <td style="padding:10px 8px;font-size:10px;vertical-align:middle">Cortina de tela (incompleta)</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
        </tr>`;
      }
      const c=calcCortinaTotal(p,telas,confecciones,rielesCustom||[]);
      const qtyC=parseInt(p.cantidad)||1;
      precioDesc=c.total;           // precio descuento por 1 pieza
      precioLista=c.total*1.40;     // precio lista por 1 pieza
      total=c.total*qtyC;           // total = precio × cantidad
    } else if(isToldoPDF){
      const c=calcToldoTotal(p);
      if(!c||c.noDisponible){
        return `<tr style="border-bottom:1px solid #e8e8e8">
          <td style="padding:10px 8px;vertical-align:middle"><div style="width:80px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999">${p.tipoProducto==="TOLDO VERTICAL"?"Toldo":"Pérgola"}</div></td>
          <td style="padding:10px 8px;font-weight:600;text-align:center;vertical-align:middle">${p.area||"—"}</td>
          <td style="padding:10px 8px;text-align:center;vertical-align:middle">${qty}</td>
          <td style="padding:10px 8px;font-size:10px;vertical-align:middle">${desc}${c&&c.noDisponible?" (medidas no disponibles)":""}</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
          <td style="padding:10px 8px;text-align:right;color:#999">—</td>
        </tr>`;
      }
      precioLista=c.subtotal*1.40;
      precioDesc=c.subtotal;
      total=c.total;
    } else if(isPapel){
      const t=calcPapelTotal(p)+extrasTotal(p.papelServicios||[]);
      const precio=parseFloat(p.papelPrecioUnit)||0;
      precioDesc=precio;            // precio unitario con descuento
      precioLista=precio*1.40;      // precio unitario lista
      total=t;                      // total calculado
    } else if(isOtro){
      const precio=parseFloat(p.otroPrecioUnit)||0;
      const cantidad=parseInt(p.otroCantidad)||1;
      precioDesc=precio;            // precio unitario con descuento
      precioLista=precio*1.40;      // precio unitario lista
      total=precio*cantidad;        // total = precio × cantidad
    } else return"";
    const imgSrc=getProductImage(p, telas);
    const tipoLabel=isPersiana?"Persiana":isCortina?"Cortina":isToldoPDF?(p.tipoProducto==="TOLDO VERTICAL"?"Toldo":"Pérgola"):isPapel?"Papel":"Otro";
    const ph=imgSrc
      ? `<img src="${imgSrc}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;display:block;" />`
      : `<div style="width:80px;height:60px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center">${tipoLabel}</div>`;
    let cantDisplay=qty;
    if(isPapel){
      if(p.papelUsarCalculadora){
        if(p.papelModo==="ROLLO"){const r=calcPapelRollos(p);cantDisplay=r?r.totalConDesperdicio+" rollos":"—";}
        else{const y=calcPapelYardas(p);cantDisplay=y?y.totalFinal+" yardas":"—";}
      } else {
        const cm=parseFloat(p.papelCantidadManual)||0;
        cantDisplay=cm>0?cm+" "+(p.papelModo==="ROLLO"?"rollos":"yardas"):"—";
      }
    } else if(isOtro){
      cantDisplay=parseInt(p.otroCantidad)||1;
    }
    return `<tr style="border-bottom:1px solid #e8e8e8">
      <td style="padding:10px 8px;vertical-align:middle">${ph}</td>
      <td style="padding:10px 8px;font-weight:600;text-align:center;vertical-align:middle">${p.area||"—"}</td>
      <td style="padding:10px 8px;text-align:center;vertical-align:middle">${cantDisplay}</td>
      <td style="padding:10px 8px;font-size:10px;vertical-align:middle">${desc}</td>
      <td style="padding:10px 8px;text-align:right;vertical-align:middle;color:#555">${precioLista>0?f(precioLista):"—"}</td>
      <td style="padding:10px 8px;text-align:right;vertical-align:middle;font-weight:600">${f(precioDesc)}</td>
      <td style="padding:10px 8px;text-align:right;vertical-align:middle;font-weight:700">${f(total)}</td>
    </tr>`;
  }).join("");

  const extraRows=globalExtras.map(function(e,i){
    const pr=parseFloat(e.precio)||0;
    const q=e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
    const precioDesc=pr*q;
    const precioLista=precioDesc*1.40;
    const extraImg=getExtraImage(e.nombre);
    const ph=extraImg
      ? '<img src="'+extraImg+'" style="width:80px;height:60px;object-fit:cover;border-radius:4px;display:block;" />'
      : '<div style="width:80px;height:60px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;text-align:center">Extra</div>';
    const desc=e.isML?(e.nombre+" ("+q+"ml)"):e.nombre+(q>1?" × "+q:"");
    return '<tr style="border-bottom:1px solid #e8e8e8"><td style="padding:10px 8px;vertical-align:middle">'+ph+'</td><td style="padding:10px 8px;font-weight:600;text-align:center;vertical-align:middle">—</td><td style="padding:10px 8px;text-align:center;vertical-align:middle">'+q+'</td><td style="padding:10px 8px;font-size:10px;vertical-align:middle">'+desc.toUpperCase()+'</td><td style="padding:10px 8px;text-align:right;vertical-align:middle;color:#555">'+f(precioLista)+'</td><td style="padding:10px 8px;text-align:right;vertical-align:middle;font-weight:600">'+f(precioDesc)+'</td><td style="padding:10px 8px;text-align:right;vertical-align:middle;font-weight:700">'+f(precioDesc)+'</td></tr>';
  }).join("");

  const subtotalBruto=pieces.reduce(function(sum,p){
    if(p.tipoProducto==="PERSIANA"){const c=calcPersianaTotal(p);return sum+(c?c.total:0);}
    if(p.tipoProducto==="CORTINA DE TELA"&&p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto)return sum+calcCortinaTotal(p,telas,confecciones,rielesCustom||[]).total*(parseInt(p.cantidad)||1);
    if(p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE"){const c=calcToldoTotal(p);return sum+((c&&!c.noDisponible)?c.total:0);}
    if(p.tipoProducto==="PAPEL DE PARED")return sum+calcPapelTotal(p)+extrasTotal(p.papelServicios||[]);
    if(p.tipoProducto==="OTRO")return sum+calcOtroTotal(p);
    return sum;
  },0)+extrasTotal(globalExtras);
  const descuentoExtra=descuento>0?descuento:0;
  const descuentoAmt=subtotalBruto*(descuentoExtra/100);
  const subtotal=subtotalBruto-descuentoAmt;
  const itbmsAmt=(subtotal+viatico)*(itbms/100);
  const grandTotal=subtotal+viatico+itbmsAmt;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Cotizacion_TBC_${((cliente.nombre+" "+cliente.apellido).trim()||"Cliente").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;font-size:11px}
.page{max-width:820px;margin:0 auto;padding:32px}
@page{margin:0.4cm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:20px}}
</style></head><body><div class="page">

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div style="flex:1">
    <div style="font-weight:700;font-size:11px;margin-bottom:8px;letter-spacing:1px">DATOS DEL CLIENTE</div>
    <div style="font-size:11px;line-height:1.8;color:#333">
      <div><strong>Nombre:</strong> ${cliente.nombre} ${cliente.apellido}</div>
      <div><strong>Dirección:</strong> ${cliente.direccion||"—"}</div>
      <div><strong>Mail:</strong> ${cliente.email||"—"}</div>
      <div><strong>Teléfono:</strong> ${cliente.telefono||"—"}</div>
    </div>
    <div style="margin-top:10px;font-weight:700;font-size:11px">Fecha: ${fecha}</div>
    <div style="margin-top:4px;font-weight:700;font-size:11px">N° Cotización: ${numCotizacion}</div>
  </div>
  <div>${empresa==="VIVENDI"
    ? '<img src="'+VIVENDI_LOGO_IMG+'" style="height:60px;width:auto;mix-blend-mode:multiply;" />'
    : LOGO_SVG
  }</div>
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:0">
  <thead>
    <tr style="background:#111;color:#fff">
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700;width:90px">IMAGEN</th>
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700">ÁREA</th>
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700;width:60px">CANTIDAD</th>
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700">DESCRIPCIÓN</th>
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700;text-align:right;width:80px">PRECIO UNIT.</th>
      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700;text-align:right;width:110px">P. UNIT. DESCUENTO</th>      <th style="padding:10px 8px;font-size:10px;letter-spacing:0.5px;font-weight:700;text-align:right;width:80px">TOTAL</th>
    </tr>
  </thead>
  <tbody>${rows}${extraRows}</tbody>
</table>

${instalacionMsg?'<div style="background:#f0f9f0;border:1px solid #c0e0c0;border-radius:4px;padding:8px 12px;margin-top:8px;font-size:10px;color:#2a6a2a;font-weight:600">'+instalacionMsg+'</div>':""}

<table style="width:100%;border-collapse:collapse;margin-top:0">
  <tr>
    <td style="padding:7px 14px;color:#555;width:90px"></td>
    <td style="padding:7px 14px;width:60px"></td>
    <td style="padding:7px 14px;width:60px"></td>
    <td style="padding:7px 14px"></td>
    <td style="padding:7px 14px;width:80px"></td>
    <td style="padding:7px 14px;width:110px"></td>
    <td style="padding:7px 14px;text-align:right;color:#555;font-size:11px;border-top:2px solid #eee;width:80px">Subtotal</td>
  </tr>
  <tr>
    <td colspan="6" style="padding:4px 14px;text-align:right;color:#555;font-size:11px">Subtotal</td>
    <td style="padding:4px 14px;text-align:right;font-size:11px">${f(subtotalBruto)}</td>
  </tr>
  ${descuentoExtra>0?`<tr>
    <td colspan="6" style="padding:4px 14px;text-align:right;color:#2a7a4a;font-size:11px;font-weight:600">Descuento (${descuentoExtra}%)</td>
    <td style="padding:4px 14px;text-align:right;font-size:11px;color:#2a7a4a;font-weight:600">- ${f(descuentoAmt)}</td>
  </tr>
  <tr>
    <td colspan="6" style="padding:4px 14px;text-align:right;color:#555;font-size:11px">Subtotal con descuento</td>
    <td style="padding:4px 14px;text-align:right;font-size:11px">${f(subtotal)}</td>
  </tr>`:""}
  <tr>
    <td colspan="6" style="padding:4px 14px;text-align:right;color:#555;font-size:11px">ITBMS (${itbms}%)</td>
    <td style="padding:4px 14px;text-align:right;font-size:11px">${f(itbmsAmt)}</td>
  </tr>
  <tr>
    <td colspan="6" style="padding:4px 14px;text-align:right;color:#555;font-size:11px">Viáticos</td>
    <td style="padding:4px 14px;text-align:right;font-size:11px">${f(viatico)}</td>
  </tr>
  <tr>
    <td colspan="6" style="padding:8px 14px;text-align:right;font-weight:800;font-size:13px;border-top:2px solid #111">Total</td>
    <td style="padding:8px 14px;text-align:right;font-weight:800;font-size:13px;border-top:2px solid #111">${f(grandTotal)}</td>
  </tr>
</table>

<div style="page-break-before:always;margin-top:0">
${(function(){
  const digitToLetter={"0":"j","1":"a","2":"b","3":"c","4":"d","5":"e","6":"f","7":"g","8":"h","9":"i"};
  function encode(n){return String(n).replace(/[0-9]/g,function(d){return digitToLetter[d];});}
  const coded=pieces.map(function(p,i){
    const ancho=p.ancho?encode(p.ancho):"";
    const alto=p.alto?encode(p.alto):"";
    return ancho&&alto?"p"+(i+1)+ancho+"x"+alto:"";
  }).filter(Boolean).join("");
  return coded?`<div style="font-size:7px;color:#999;margin-bottom:16px;letter-spacing:0;line-height:1;word-break:break-all">${numCotizacion}:${coded}</div>`:"";
})()}
${empresa==="VIVENDI"?VIVENDI_TERMS:TERMS}</div>

${comentarios?`<div style="margin-top:24px;padding:16px 20px;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;font-size:11px;line-height:1.7;color:#333"><strong style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#888">Comentarios y Notas</strong><p style="margin-top:8px;white-space:pre-wrap">${comentarios.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p></div>`:""}

${stateBlob?`<div style="page-break-before:always;color:#ffffff;background:#ffffff;font-size:8px;line-height:1.3;overflow-wrap:anywhere;word-break:break-all">${stateBlob}</div>`:""}

</div><script>window.onload=function(){setTimeout(function(){window.print();},500);}</script></body></html>`;
}

// ─── PIECES SUMMARY ────────────────────────────────────────────────────────────
function GlobalExtrasSummary({extras}){
  if(!extras||extras.length===0)return null;
  return extras.map(function(e){
    const pr=parseFloat(e.precio)||0;
    const q=e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
    const total=pr*q;
    return(
      <div key={e.id} style={{...S.priceRow,marginBottom:6}}>
        <span style={{color:C.text}}>{e.nombre}{e.isML?" ("+q+"ml)":q>1?" × "+q:""}</span>
        <span style={{color:C.goldL,fontWeight:700}}>{fmt(total)}</span>
      </div>
    );
  });
}

function PiecesSummary({pieces,telas,confecciones,rielesCustom}){
  return pieces.map(function(p,i){
    let sub=0,label="",complete=false;
    if(p.tipoProducto==="PERSIANA"){
      const c=calcPersianaTotal(p);
      sub=c?c.total:0;label=p.area||(p.tipoPersiana||"Persiana");complete=!!c;
    } else if(p.tipoProducto==="CORTINA DE TELA"){
      const ok=p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto;
      const qty=parseInt(p.cantidad)||1;
      sub=ok?calcCortinaTotal(p,telas,confecciones,rielesCustom||[]).total*qty:0;label=p.area||"Cortina de tela";complete=!!ok;
    } else if(p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE"){
      const c=calcToldoTotal(p);
      sub=(c&&!c.noDisponible)?c.total:0;
      label=p.area||(p.tipoProducto==="TOLDO VERTICAL"?"Toldo Vertical":"Pérgola Brazo Extensible");
      complete=!!(c&&!c.noDisponible);
    } else if(p.tipoProducto==="PAPEL DE PARED"){
      sub=calcPapelTotal(p)+extrasTotal(p.papelServicios||[]);
      label=p.area||"Papel de pared";complete=sub>0;
    } else if(p.tipoProducto==="OTRO"){
      sub=calcOtroTotal(p);
      label=p.area||(p.otroDescripcion||"Otro");complete=sub>0;
    }
    const qty=parseInt(p.cantidad)||1;
    return(
      <div key={p.id} style={{...S.priceRow,marginBottom:6,opacity:complete?1:0.4}}>
        <span style={{color:C.text}}>
          Pieza #{i+1} — {label}{p.tipoProducto==="PERSIANA"&&qty>1?" × "+p.cantidad:""}
          {!complete&&<span style={{color:"#ff8080",fontSize:10,marginLeft:6}}>(sin precio)</span>}
        </span>
        <span style={{color:complete?C.goldL:"#aaa",fontWeight:700}}>{complete?fmt(sub):"—"}</span>
      </div>
    );
  });
}

// ─── ORDEN DE PRODUCCIÓN ────────────────────────────────────────────────────
// Campos requeridos por tipo de producto
function camposOrdenPorTipo(tipo){
  if(tipo==="PERSIANA")return [
    {key:"colorTela",label:"Color y código de tela",type:"text",req:true,mem:"colorTela"},
    {key:"contrapeso",label:"Tipo de contrapeso",type:"text",req:true,mem:"contrapeso"},
    {key:"mando",label:"Mando",type:"select",options:["Derecha","Izquierda"],req:true},
    {key:"enrollado",label:"Enrollado",type:"select",options:["Regular","Trasero"],req:true},
    {key:"notas",label:"Notas",type:"text",req:false},
  ];
  if(tipo==="CORTINA DE TELA")return [
    {key:"tipoBasta",label:"Tipo de basta",type:"text",req:true,mem:"tipoBasta"},
    {key:"instalacion",label:"Instalación",type:"select",options:["Pared","Techo"],req:true},
    {key:"notas",label:"Notas",type:"text",req:false},
  ];
  if(tipo==="TOLDO VERTICAL"||tipo==="PÉRGOLA BRAZO EXTENSIBLE")return [
    {key:"colorTela",label:"Color y código de tela",type:"text",req:true,mem:"colorTela"},
    {key:"notas",label:"Notas",type:"text",req:false},
  ];
  return [{key:"notas",label:"Notas",type:"text",req:false}];
}

// Solo piezas que van a producción (no papel/otro)
function piezasProduccion(pieces){
  return pieces.filter(function(p){
    return p.tipoProducto==="PERSIANA"||p.tipoProducto==="CORTINA DE TELA"||p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE";
  });
}

function ordenPieceComplete(piece, datos){
  const campos=camposOrdenPorTipo(piece.tipoProducto);
  const d=datos||{};
  return campos.every(function(c){ return !c.req || (d[c.key]!==undefined && String(d[c.key]).trim()!==""); });
}

// Construye el HTML de la orden de producción (sin precios)
function buildOrdenHTML(prod, ordenData, telas, confecciones, rielesCustom, motoresCustom, controlesCustom, cliente, numCotizacion, empresa){
  const fecha = new Date().toLocaleDateString("es-CR");
  const numOrden = numCotizacion ? numCotizacion.replace(/^(TBC|VIV)-/, "ORD-") : "ORD-";
  const clienteNom = (cliente.nombre+" "+cliente.apellido).trim() || "—";
  const esc = function(s){ return String(s==null?"":s).replace(/</g,"&lt;").replace(/>/g,"&gt;"); };

  function motorNombre(p){ const m=[...MOTORES,...MOTORES_TOLDO,...MOTORES_PERGOLA,...(motoresCustom||[])].find(function(x){return x.id===p.motorId;}); return m?m.nombre:"—"; }
  function controlNombre(p){ const c=[...PERSIANA_CONTROLES,...CORTINA_CONTROLES,...CONTROLES_TOLDO,...(controlesCustom||[])].find(function(x){return x.id===p.controlId;}); return c?c.nombre:"—"; }
  function getD(p){ return ordenData[p.id] || {}; }

  const tiposOrden = [
    {tipo:"PERSIANA", titulo:"PERSIANAS", color:"#B8965A"},
    {tipo:"CORTINA DE TELA", titulo:"CORTINAS DE TELA", color:"#3E9E88"},
    {tipo:"TOLDO VERTICAL", titulo:"TOLDOS VERTICALES", color:"#3E7EA8"},
    {tipo:"PÉRGOLA BRAZO EXTENSIBLE", titulo:"PÉRGOLAS BRAZO EXTENSIBLE", color:"#3E7EA8"},
  ];

  function filaDato(label, valor){
    return `<td style="padding:8px 10px;border:1px solid #ddd;vertical-align:top">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#999;font-weight:700;margin-bottom:3px">${esc(label)}</div>
      <div style="font-size:12px;color:#111;font-weight:600">${esc(valor||"—")}</div>
    </td>`;
  }

  let secciones = "";
  tiposOrden.forEach(function(t){
    const piezas = prod.filter(function(p){ return p.tipoProducto===t.tipo; });
    if(piezas.length===0) return;
    let filas = "";
    piezas.forEach(function(p, i){
      const d = getD(p);
      const producto = descProductoPieza(p, telas);
      const medidas = (p.ancho&&p.alto) ? (p.ancho+" × "+p.alto+" cm") : "—";
      const cant = parseInt(p.cantidad)||1;
      let celdas = "";
      celdas += filaDato("Pieza", "#"+(i+1));
      celdas += filaDato("Área", p.area);
      celdas += filaDato("Producto", producto);
      celdas += filaDato("Medidas", medidas);
      if(cant>1) celdas += filaDato("Cantidad", cant);
      if(t.tipo==="PERSIANA"){
        if(p.tipoAccionamiento==="MOTORIZADA"){ celdas += filaDato("Motor", motorNombre(p)); celdas += filaDato("Control", controlNombre(p)); }
        celdas += filaDato("Color/código tela", d.colorTela);
        celdas += filaDato("Tipo de contrapeso", d.contrapeso);
        celdas += filaDato("Mando", d.mando);
        celdas += filaDato("Enrollado", d.enrollado);
      } else if(t.tipo==="CORTINA DE TELA"){
        const tela=[...(telas||[])].find(function(x){return x.id===p.telaId;});
        const conf=[...(confecciones||[])].find(function(x){return x.id===p.confeccionId;});
        const riel=[...RIELES,...(rielesCustom||[])].find(function(x){return x.id===p.rielId;});
        celdas += filaDato("Confección", conf?conf.nombre:"—");
        celdas += filaDato("Riel", riel?riel.nombre:"—");
        celdas += filaDato("Vías", p.dosVias?"2 vías":"1 vía");
        celdas += filaDato("Tipo de basta", d.tipoBasta);
        celdas += filaDato("Instalación", d.instalacion);
      } else {
        if(p.tipoAccionamiento==="MOTORIZADA"){ celdas += filaDato("Motor", motorNombre(p)); celdas += filaDato("Control", controlNombre(p)); }
        celdas += filaDato("Color/código tela", d.colorTela);
      }
      const notas = d.notas ? `<tr><td colspan="6" style="padding:8px 10px;border:1px solid #ddd;background:#fafafa"><span style="font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#999;font-weight:700">Notas: </span><span style="font-size:11px;color:#333">${esc(d.notas)}</span></td></tr>` : "";
      const imgSrc = getProductImage(p, telas);
      const imgBlock = imgSrc ? `<div style="flex-shrink:0;width:90px;height:68px;border-radius:6px;overflow:hidden;border:1px solid #e0e0e0"><img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover" /></div>` : "";
      filas += `<div style="margin-bottom:14px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;page-break-inside:avoid">
        <div style="display:flex;gap:12px;align-items:stretch">
          ${imgSrc?`<div style="padding:10px 0 10px 10px;display:flex;align-items:center">${imgBlock}</div>`:""}
          <div style="flex:1;min-width:0">
            <table style="width:100%;border-collapse:collapse;table-layout:fixed"><tbody>
              <tr>${celdas}</tr>
              ${notas}
            </tbody></table>
          </div>
        </div>
      </div>`;
    });
    secciones += `<div style="margin-top:22px;page-break-inside:avoid">
      <div style="background:${t.color};color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:800;letter-spacing:.5px">${t.titulo} <span style="opacity:.8;font-weight:600">(${piezas.length})</span></div>
      <div style="padding:14px;background:#fff;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 8px 8px">${filas}</div>
    </div>`;
  });

  const logoBlock = empresa==="VIVENDI"
    ? '<img src="'+VIVENDI_LOGO_IMG+'" style="height:54px;width:auto;mix-blend-mode:multiply;" />'
    : LOGO_SVG;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Orden ${numOrden}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;font-size:11px}
.page{max-width:820px;margin:0 auto;padding:32px}
@page{margin:0.4cm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:20px}}
</style></head><body><div class="page">
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:8px">
  <div>
    <div style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;font-weight:600">Orden de Producción</div>
    <div style="font-size:22px;font-weight:900;color:#111;margin-top:2px">${numOrden}</div>
    <div style="margin-top:10px;font-size:12px;color:#333"><strong>Fecha:</strong> ${fecha}</div>
    <div style="font-size:12px;color:#333"><strong>N° Cotización:</strong> ${esc(numCotizacion||"—")}</div>
  </div>
  <div>${logoBlock}</div>
</div>
${secciones}
<div style="margin-top:30px;padding-top:14px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center">
  Documento interno de producción — ${empresa==="VIVENDI"?"Vivendi Decor":"The Blind Concept"}
</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();},500);}</script></body></html>`;
}

// Devuelve el nombre del producto/material específico de la pieza
function descProductoPieza(p, telas){
  if(p.tipoProducto==="PERSIANA") return p.tipoPersiana || "Persiana";
  if(p.tipoProducto==="CORTINA DE TELA"){
    const t = telas ? telas.find(function(x){return x.id===p.telaId;}) : null;
    return t ? t.nombre : "Cortina de tela";
  }
  if(p.tipoProducto==="TOLDO VERTICAL") return "Toldo Vertical";
  if(p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE") return "Pérgola Brazo Extensible";
  return p.tipoProducto;
}

function OrdenProduccion({pieces, telas, confecciones, rielesCustom, cliente, numCotizacion, empresa, ordenData, setOrdenData, onClose, onSacarOrden}){
  const prod = piezasProduccion(pieces);
  const numOrden = numCotizacion ? numCotizacion.replace(/^(TBC|VIV)-/, "ORD-") : "ORD-—";

  function setCampo(pieceId, key, val){
    setOrdenData(function(prev){
      const prevP = prev[pieceId] || {};
      return {...prev, [pieceId]: {...prevP, [key]: val}};
    });
  }

  // Memoria de valores por uso: junta todos los valores escritos para cada campo "mem"
  function valoresMemoria(memKey, tipoProducto){
    const set = {};
    prod.forEach(function(p){
      // colorTela se comparte entre persianas/toldos/pérgolas; tipoBasta solo cortinas; contrapeso solo persianas
      let aplica = false;
      if(memKey==="colorTela") aplica = (p.tipoProducto==="PERSIANA"||p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE");
      else if(memKey==="tipoBasta") aplica = (p.tipoProducto==="CORTINA DE TELA");
      else if(memKey==="contrapeso") aplica = (p.tipoProducto==="PERSIANA");
      if(!aplica) return;
      const d = ordenData[p.id] || {};
      const v = d[memKey];
      if(v && String(v).trim()!=="") set[String(v).trim()] = true;
    });
    return Object.keys(set);
  }

  const incompletas = prod.filter(function(p){ return !ordenPieceComplete(p, ordenData[p.id]); });

  return (
    <div style={{position:"fixed",inset:0,zIndex:9998,background:C.dark,overflowY:"auto"}}>
      <div style={{...S.header,position:"sticky",top:0,zIndex:5}}>
        {empresa==="VIVENDI" ? <VivendiLogo/> : <TBCLogo/>}
        <div style={{marginLeft:16,borderLeft:"1px solid #e8e8e8",paddingLeft:20,flex:1}}>
          <div style={{fontSize:11,color:"#999",letterSpacing:1.5,textTransform:"uppercase",fontWeight:500}}>Orden de Producción</div>
          <div style={{fontSize:13,color:"#111",fontWeight:700,marginTop:2}}>{numOrden}</div>
        </div>
        <button onClick={onClose} style={{background:"transparent",border:"1px solid #ddd",borderRadius:8,padding:"6px 14px",color:"#999",fontSize:12,cursor:"pointer"}}>← Volver</button>
      </div>

      <div style={S.page}>
        <div style={{...S.card,borderColor:"rgba(184,150,90,.3)"}}>
          <div style={S.sectionLabel}>🏭 Datos de Fabricación</div>
          <div style={{fontSize:12,color:"#aaa",lineHeight:1.6,marginBottom:8}}>
            Completá los datos de cada pieza para generar la orden. Cliente: <strong style={{color:C.text}}>{(cliente.nombre+" "+cliente.apellido).trim()||"—"}</strong>
          </div>
        </div>

        {prod.length===0 && (
          <div style={{...S.card,textAlign:"center",color:"#aaa"}}>No hay piezas de producción (persianas, cortinas, toldos o pérgolas) en esta cotización.</div>
        )}

        {prod.map(function(p, idx){
          const campos = camposOrdenPorTipo(p.tipoProducto);
          const datos = ordenData[p.id] || {};
          const complete = ordenPieceComplete(p, datos);
          const tipoColor = p.tipoProducto==="PERSIANA"?C.gold:(p.tipoProducto==="CORTINA DE TELA"?"#64c8b4":"#50a0dc");
          const producto = descProductoPieza(p, telas);
          return (
            <div key={p.id} style={{...S.card,borderColor:complete?"rgba(76,175,125,.3)":"rgba(224,85,85,.3)"}}>
              {/* Cabecera de pieza: grande y contrastada */}
              <div style={{marginBottom:18,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
                  <span style={{fontSize:18,fontWeight:900,color:tipoColor}}>Pieza #{idx+1}</span>
                  {complete ? <span style={S.badge(C.green)}>✓ Completa</span> : <span style={S.badge("#E05555")}>⚠ Faltan datos</span>}
                </div>
                <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10,color:"#777",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Producto</div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>{producto}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:"#777",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Área</div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>{p.area||"—"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:"#777",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Medidas</div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>{(p.ancho&&p.alto)?(p.ancho+" × "+p.alto+" cm"):"—"}</div>
                  </div>
                  {(parseInt(p.cantidad)||1)>1 && (
                    <div>
                      <div style={{fontSize:10,color:"#777",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Cantidad</div>
                      <div style={{fontSize:16,fontWeight:800,color:C.text}}>{p.cantidad}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={S.g2}>
                {campos.map(function(campo){
                  const val = datos[campo.key] || "";
                  const falta = campo.req && String(val).trim()==="";
                  if(campo.type==="select"){
                    return (
                      <div key={campo.key} style={S.field}>
                        <div style={{...S.lbl,color:falta?"#E05555":"#ccc"}}>{campo.label}{campo.req&&<span style={{color:"#E05555"}}> *</span>}</div>
                        <div style={S.radioRow}>
                          {campo.options.map(function(opt){
                            return <div key={opt} style={S.radio(val===opt)} onClick={function(){setCampo(p.id,campo.key,opt);}}>{opt}</div>;
                          })}
                        </div>
                      </div>
                    );
                  }
                  // Texto, con datalist de memoria si aplica
                  const listId = campo.mem ? ("mem-"+campo.mem+"-"+p.id) : undefined;
                  const memVals = campo.mem ? valoresMemoria(campo.mem, p.tipoProducto).filter(function(v){return v!==val;}) : [];
                  return (
                    <div key={campo.key} style={S.field}>
                      <div style={{...S.lbl,color:falta?"#E05555":"#ccc"}}>{campo.label}{campo.req&&<span style={{color:"#E05555"}}> *</span>}</div>
                      <input style={{...S.inp,borderColor:falta?"#E05555":undefined}} value={val} list={listId} onChange={function(e){setCampo(p.id,campo.key,e.target.value);}} placeholder={campo.label}/>
                      {listId && (
                        <datalist id={listId}>
                          {memVals.map(function(v){ return <option key={v} value={v}/>; })}
                        </datalist>
                      )}
                      {campo.mem && memVals.length>0 && (
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                          {memVals.map(function(v){
                            return <div key={v} style={{...S.badge(C.gold),cursor:"pointer"}} onClick={function(){setCampo(p.id,campo.key,v);}}>{v}</div>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {prod.length>0 && (
          incompletas.length>0 ? (
            <div style={{marginTop:8}}>
              <div style={{background:"rgba(224,85,85,.1)",border:"1px solid rgba(224,85,85,.3)",borderRadius:12,padding:"14px 18px",marginBottom:10}}>
                <div style={{color:"#E05555",fontWeight:700,fontSize:13}}>⚠ Completá los datos obligatorios (*) de todas las piezas antes de sacar la orden.</div>
              </div>
              <button style={{...S.genBtn,marginTop:0,opacity:0.4,cursor:"not-allowed"}} disabled>📄 Sacar Orden</button>
            </div>
          ) : (
            <button style={{...S.genBtn,marginTop:8}} onClick={onSacarOrden}>📄 Sacar Orden de Producción</button>
          )
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function CotizadorTBC(){
  const[empresa,setEmpresa]=useState("");
  const[cliente,setCliente]=useState({nombre:"",apellido:"",direccion:"",email:"",telefono:""});
  const[pieces,setPieces]=useState([newPiece()]);
  const[telas,setTelas]=useState([...DEFAULT_TELAS]);
  const[confecciones,setConfecciones]=useState([...DEFAULT_CONFECCIONES]);
  const[rielesCustom,setRielesCustom]=useState([]);
  const[motoresCustom,setMotoresCustom]=useState([]);
  const[controlesCustom,setControlesCustom]=useState([]);
  const[cenefasCustom,setCenefasCustom]=useState([]);
  const[preview,setPreview]=useState(null);
  const[ordenPreview,setOrdenPreview]=useState(null);
  const[globalExtras,setGlobalExtras]=useState([]);
  const[viatico,setViatico]=useState(0);
  const[itbms,setItbms]=useState(7);
  const[descuento,setDescuento]=useState(0);
  const[comentarios,setComentarios]=useState("");
  const[numCotizacion,setNumCotizacion]=useState(function(){return generarNumCotizacion("TBC");});
  const[ordenData,setOrdenData]=useState({});
  const[showOrden,setShowOrden]=useState(false);
  const[extrasPendiente,setExtrasPendiente]=useState(false);
  const[customPendientes,setCustomPendientes]=useState({});
  const hayCustomPendiente=Object.values(customPendientes).some(function(v){return v;});
  const makePendingHandler=React.useCallback(function(key){
    return function(isPending){
      setCustomPendientes(function(prev){
        if(prev[key]===isPending)return prev;
        return {...prev,[key]:isPending};
      });
    };
  },[]);
  const[toast,setToast]=useState(null);
  const[loadingQR,setLoadingQR]=useState(false);
  const fileInputRef=React.useRef(null);

  function showToast(msg){
    setToast(msg);
    setTimeout(function(){setToast(null);}, 2500);
  }
  const showToastRef = showToast;

  function updateCliente(k,v){setCliente(function(p){return{...p,[k]:v};});}
  const updatePiece=useCallback(function(idx,val,action){
    if(action==="clone"){
      setPieces(function(ps){
        const newPs=[...ps];
        newPs.splice(idx+1,0,val);
        return newPs;
      });
      setToast("✓ Pieza duplicada correctamente");
      setTimeout(function(){setToast(null);}, 2500);
    } else {
      setPieces(function(ps){return ps.map(function(p,i){return i===idx?val:p;});});
    }
  },[]);
  function removePiece(idx){setPieces(function(ps){return ps.filter(function(_,i){return i!==idx;});});}

  // Inyecta catálogos personalizados en cada pieza para que las funciones de cálculo y descripción los reconozcan
  const enrichPiece=function(p){return{...p,_motoresCustom:motoresCustom,_controlesCustom:controlesCustom,_cenefasCustom:cenefasCustom};};
  const enrichedPieces=pieces.map(enrichPiece);

  const piecesTotal=enrichedPieces.reduce(function(sum,p){
    if(p.tipoProducto==="PERSIANA"){const c=calcPersianaTotal(p);return sum+(c?c.total:0);}
    if(p.tipoProducto==="CORTINA DE TELA"&&p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto)return sum+calcCortinaTotal(p,telas,confecciones,rielesCustom||[]).total*(parseInt(p.cantidad)||1);
    if(p.tipoProducto==="TOLDO VERTICAL"||p.tipoProducto==="PÉRGOLA BRAZO EXTENSIBLE"){const c=calcToldoTotal(p);return sum+((c&&!c.noDisponible)?c.total:0);}
    if(p.tipoProducto==="PAPEL DE PARED")return sum+calcPapelTotal(p)+extrasTotal(p.papelServicios||[]);
    if(p.tipoProducto==="OTRO")return sum+calcOtroTotal(p);
    return sum;
  },0);
  const subtotalBruto=piecesTotal+extrasTotal(globalExtras);
  const descuentoAmt=descuento>0?subtotalBruto*(descuento/100):0;
  const grandTotal=subtotalBruto-descuentoAmt;
  const itbmsAmt=(grandTotal+viatico)*(itbms/100);
  const totalFinal=grandTotal+viatico+itbmsAmt;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Extrae el estado actual para guardar en QR
  function buildQRState() {
    const cleanPieces = pieces.map(function(p) {
      const { _motoresCustom, _controlesCustom, _cenefasCustom, ...rest } = p;
      return rest;
    });
    const customTelas = telas.filter(function(t) { return !DEFAULT_TELAS.find(function(dt) { return dt.id === t.id; }); });
    const customConf = confecciones.filter(function(c) { return !DEFAULT_CONFECCIONES.find(function(dc) { return dc.id === c.id; }); });
    return { v:1, empresa, cliente, pieces:cleanPieces, globalExtras, customTelas, customConf, rielesCustom, motoresCustom, controlesCustom, cenefasCustom, viatico, itbms, descuento, comentarios, numCotizacion, ordenData };
  }

  // Restaura el estado desde un objeto de QR
  function restoreFromQRState(state) {
    if (!state || !state.v) return false;
    setEmpresa(state.empresa || "");
    setCliente(state.cliente || { nombre:"", apellido:"", direccion:"", email:"", telefono:"" });
    setPieces(state.pieces && state.pieces.length > 0 ? state.pieces : [newPiece()]);
    setGlobalExtras(state.globalExtras || []);
    setTelas([...DEFAULT_TELAS, ...(state.customTelas || [])]);
    setConfecciones([...DEFAULT_CONFECCIONES, ...(state.customConf || [])]);
    setRielesCustom(state.rielesCustom || []);
    setMotoresCustom(state.motoresCustom || []);
    setControlesCustom(state.controlesCustom || []);
    setCenefasCustom(state.cenefasCustom || []);
    setViatico(state.viatico || 0);
    setItbms(state.itbms !== undefined ? state.itbms : 7);
    setDescuento(state.descuento || 0);
    setComentarios(state.comentarios || "");
    if(state.numCotizacion)setNumCotizacion(state.numCotizacion);
    setOrdenData(state.ordenData || {});
    setPreview(null);
    return true;
  }

  // Handler: cargar cotización desde PDF (lee texto oculto)
  async function handleLoadFromFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setLoadingQR(true);
    showToast("🔍 Leyendo cotización del PDF...");
    try {
      const blob = await readStateFromPDF(file);
      if (blob) {
        const state = await decompressState(blob);
        if (state && restoreFromQRState(state)) {
          showToast("✓ Cotización cargada correctamente");
        } else {
          showToast("⚠ No se pudo leer la cotización de este PDF");
        }
      } else {
        showToast("⚠ Este PDF no contiene datos de cotización");
      }
    } catch(err) {
      showToast("⚠ Error al leer el PDF");
    } finally {
      setLoadingQR(false);
    }
  }

  async function handleDownloadPDF() {
    setLoadingQR(true);
    try {
      const qrState = buildQRState();
      const stateBlob = await compressState(qrState);
      const html = buildPDF(cliente, enrichedPieces, telas, confecciones, viatico, itbms, globalExtras, empresa, descuento, rielesCustom, comentarios, stateBlob, numCotizacion);
      setPreview(html);
    } catch(e) {
      const html = buildPDF(cliente, enrichedPieces, telas, confecciones, viatico, itbms, globalExtras, empresa, descuento, rielesCustom, comentarios, null, numCotizacion);
      setPreview(html);
    } finally {
      setLoadingQR(false);
    }
  }

  function loadSheetJS(cb) {
    if (window.XLSX) { cb(window.XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = function(){ cb(window.XLSX); };
    s.onerror = function(){ alert("No se pudo cargar SheetJS. Verifica tu conexión."); };
    document.head.appendChild(s);
  }

  function handleSacarOrden() {
    const prod = piezasProduccion(enrichedPieces);
    if(prod.length===0){ setToast("⚠ No hay piezas de producción"); setTimeout(function(){setToast(null);},2500); return; }
    const html = buildOrdenHTML(prod, ordenData, telas, confecciones, rielesCustom, motoresCustom, controlesCustom, cliente, numCotizacion, empresa);
    setShowOrden(false);
    setOrdenPreview(html);
  }

  function handleDownloadExcel() {
    loadSheetJS(function(XLSX) {
      const wb = XLSX.utils.book_new();
      const fecha = new Date().toLocaleDateString("es-CR");
      const f = function(n){ return Math.round(Number(n||0)*100)/100; };

      // ── Sheet 1: Cotización ──────────────────────────────────────────────
      const data = [];

      // Header info
      data.push(["COTIZACIÓN — THE BLIND CONCEPT"]);
      data.push(["Fecha:", fecha]);
      data.push([]);
      data.push(["DATOS DEL CLIENTE"]);
      data.push(["Nombre:", cliente.nombre+" "+cliente.apellido]);
      data.push(["Dirección:", cliente.direccion||""]);
      data.push(["Email:", cliente.email||""]);
      data.push(["Teléfono:", cliente.telefono||""]);
      data.push([]);

      // Table headers
      data.push(["#","ÁREA","TIPO","DESCRIPCIÓN","CANTIDAD","PRECIO LISTA ($)","PRECIO CON DESCUENTO ($)","TOTAL ($)"]);
      const headerRow = data.length;

      let rowNum = 1;
      enrichedPieces.forEach(function(p) {
        const isPersiana = p.tipoProducto === "PERSIANA";
        const qty = parseInt(p.cantidad)||1;
        const desc = buildDesc(p,telas,confecciones,rielesCustom||[]);
        if (isPersiana) {
          const c = calcPersianaTotal(p);
          if (c) {
            data.push([rowNum++, p.area||"", "PERSIANA", desc, qty, f(c.base*qty), f(c.subtotal*qty), f(c.total)]);
          }
        } else if (p.telaId&&p.confeccionId&&p.rielId&&p.ancho&&p.alto) {
          const c = calcCortinaTotal(p,telas,confecciones,rielesCustom||[]);
          data.push([rowNum++, p.area||"", "CORTINA", desc, 1, f(c.total), f(c.total), f(c.total)]);
        }
      });

      globalExtras.forEach(function(e) {
        const pr = parseFloat(e.precio)||0;
        const q = e.isML?(parseFloat(e.metros)||0):(parseInt(e.cantidad)||1);
        data.push([rowNum++, "—", "EXTRA", e.nombre, q, f(pr*q*1.40), f(pr*q), f(pr*q)]);
      });

      // Totals
      data.push([]);
      data.push(["","","","","","","Subtotal:", f(grandTotal)]);
      data.push(["","","","","","","Viático:", f(viatico)]);
      data.push(["","","","","","","ITBMS ("+itbms+"%):", f(itbmsAmt)]);
      data.push(["","","","","","","TOTAL FINAL:", f(totalFinal)]);
      data.push([]);
      data.push(["Válido por 30 días. Precios en USD."]);

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Column widths
      ws["!cols"] = [
        {wch:5},  // #
        {wch:18}, // área
        {wch:12}, // tipo
        {wch:45}, // descripción
        {wch:10}, // cantidad
        {wch:18}, // precio lista
        {wch:22}, // precio desc
        {wch:14}, // total
      ];

      // Bold header row
      const headerStyle = {font:{bold:true}};
      ["A","B","C","D","E","F","G","H"].forEach(function(col){
        const cell = ws[col+headerRow];
        if (cell) cell.s = headerStyle;
      });

      XLSX.utils.book_append_sheet(wb, ws, "Cotización");

      // ── Sheet 2: Detalle Persianas ──────────────────────────────────────
      const persianas = enrichedPieces.filter(function(p){
        return p.tipoProducto==="PERSIANA" && p.tipoPersiana && p.ancho && p.alto;
      });
      if (persianas.length > 0) {
        const dp = [["DETALLE DE PERSIANAS"],[]];
        dp.push(["Área","Tipo","Ancho (cm)","Alto (cm)","Cantidad","P. Lista","Multiplicador","P. Ajustado","Instalación","Motor","Control","Cenefa","Perfiles","TOTAL"]);
        persianas.forEach(function(p){
          const c = calcPersianaTotal(p);
          if (!c) return;
          const motorObj = [...MOTORES,...(motoresCustom||[])].find(function(m){return m.id===p.motorId;});
          const ctrlObj = [...PERSIANA_CONTROLES,...(controlesCustom||[])].find(function(x){return x.id===p.controlId;});
          const cenefaObj = [...CENEFAS,...(cenefasCustom||[])].find(function(x){return x.id===p.cenefaId;});
          dp.push([
            p.area||"", p.tipoPersiana, f(p.ancho), f(p.alto), parseInt(p.cantidad)||1,
            f(c.base), c.mult, f(c.ajustado),
            f(c.instPrecio),
            motorObj?motorObj.nombre:"—",
            ctrlObj?ctrlObj.nombre:"—",
            p.cenefa&&cenefaObj?cenefaObj.nombre+" "+f(c.cenefaML)+"ml":"—",
            p.perfiles?f(c.perfilesML)+"ml":"—",
            f(c.total)
          ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(dp);
        ws2["!cols"] = [{wch:16},{wch:22},{wch:11},{wch:11},{wch:10},{wch:12},{wch:13},{wch:13},{wch:12},{wch:20},{wch:20},{wch:20},{wch:14},{wch:12}];
        XLSX.utils.book_append_sheet(wb, ws2, "Detalle Persianas");
      }

      // Download
      const nombre = (cliente.apellido||cliente.nombre||"Cotizacion").replace(/\s+/g,"_");
      XLSX.writeFile(wb, "Cotizacion_TBC_"+nombre+"_"+new Date().toISOString().slice(0,10)+".xlsx");
    });
  }

  // Empresa selector - must choose before accessing cotizador
  if(!empresa) return (
    <div style={{...S.wrap,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{...S.card,maxWidth:420,width:"100%",textAlign:"center",padding:"40px 32px"}}>
        <div style={{marginBottom:24}}>
          <TBCLogo/>
        </div>
        <div style={{fontSize:13,color:"#aaa",marginBottom:28,lineHeight:1.6}}>
          Selecciona la empresa para la cual estás generando la cotización
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <button
            onClick={function(){setEmpresa("TBC");setNumCotizacion(function(n){return n?n.replace(/^(TBC|VIV)-/,"TBC-"):generarNumCotizacion("TBC");});}}
            style={{...S.genBtn,marginTop:0,background:C.gold,padding:"16px 24px",fontSize:14}}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
              <TBCLogo/>
            </div>
            <div style={{marginTop:8,fontSize:13}}>The Blind Concept</div>
          </button>
          <button
            onClick={function(){setEmpresa("VIVENDI");setNumCotizacion(function(n){return n?n.replace(/^(TBC|VIV)-/,"VIV-"):generarNumCotizacion("VIVENDI");});}}
            style={{...S.genBtn,marginTop:0,background:"#111",padding:"16px 24px",fontSize:14,border:"2px solid #333"}}
          >
            <VivendiLogo/>
            <div style={{marginTop:8,fontSize:13,color:"#aaa"}}>Vivendi Decor</div>
          </button>
        </div>
      </div>
    </div>
  );

  if(ordenPreview)return(
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"#000",display:"flex",flexDirection:"column"}}>
      {toast&&(
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",border:"1px solid #333",borderRadius:10,padding:"12px 24px",color:"#fff",fontSize:13,fontWeight:600,zIndex:99999,boxShadow:"0 4px 20px rgba(0,0,0,.4)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
      <div style={{background:"#1a1a1a",borderBottom:"1px solid #333",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button
            onClick={function(){
              const numOrden = numCotizacion ? numCotizacion.replace(/^(TBC|VIV)-/, "ORD-") : "ORD";
              const nombre = ((cliente.apellido||cliente.nombre)||"Orden").replace(/\s+/g,"_");
              const fileName = "Orden_"+numOrden+"_"+nombre+".html";
              try {
                const blob = new Blob([ordenPreview], {type:"text/html"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
                setToast("✓ Descargando "+fileName);
                setTimeout(function(){setToast(null);}, 2500);
              } catch(err) {
                setToast("✗ No se pudo descargar");
                setTimeout(function(){setToast(null);}, 2500);
              }
            }}
            style={{background:C.gold,border:"none",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            ⬇️ Descargar
          </button>
          <button
            onClick={function(){
              const base64 = btoa(unescape(encodeURIComponent(ordenPreview)));
              const dataUrl = "data:text/html;base64," + base64;
              try {
                navigator.clipboard.writeText(dataUrl).then(function(){
                  setToast("✓ Link copiado — pégalo en Safari");
                  setTimeout(function(){setToast(null);}, 2500);
                }).catch(function(){
                  const ta = document.createElement("textarea");
                  ta.value = dataUrl;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  document.body.appendChild(ta);
                  ta.focus(); ta.select();
                  try { document.execCommand("copy"); setToast("✓ Link copiado — pégalo en Safari"); }
                  catch(e) { setToast("✗ No se pudo copiar automáticamente"); }
                  document.body.removeChild(ta);
                  setTimeout(function(){setToast(null);}, 2500);
                });
              } catch(e) {
                setToast("✗ No se pudo copiar automáticamente");
                setTimeout(function(){setToast(null);}, 2500);
              }
            }}
            style={{background:"#444",border:"1px solid #666",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            📋 Copiar link para Safari
          </button>
        </div>
        <button onClick={function(){setOrdenPreview(null);setShowOrden(true);}} style={{background:"rgba(255,80,80,.2)",border:"1px solid rgba(255,80,80,.4)",borderRadius:8,padding:"7px 16px",color:"#ff8080",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          ✕ Volver
        </button>
      </div>
      <iframe id="orden-preview-iframe" srcDoc={ordenPreview} style={{flex:1,border:"none",background:"#fff"}} title="Orden de Producción"/>
    </div>
  );

  if(preview)return(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000",display:"flex",flexDirection:"column"}}>
      {toast&&(
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",border:"1px solid #333",borderRadius:10,padding:"12px 24px",color:"#fff",fontSize:13,fontWeight:600,zIndex:99999,boxShadow:"0 4px 20px rgba(0,0,0,.4)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
      <div style={{background:"#1a1a1a",borderBottom:"1px solid #333",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button
            onClick={function(){
              const nombre = ((cliente.nombre+" "+cliente.apellido).trim()||"Cotizacion").replace(/\s+/g,"_");
              const fechaStr = new Date().toISOString().slice(0,10);
              const fileName = "Cotizacion_TBC_"+nombre+"_"+fechaStr+".html";
              try {
                const blob = new Blob([preview], {type:"text/html"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
                setToast("✓ Descargando "+fileName);
                setTimeout(function(){setToast(null);}, 2500);
              } catch(err) {
                setToast("✗ No se pudo descargar");
                setTimeout(function(){setToast(null);}, 2500);
              }
            }}
            style={{background:C.gold,border:"none",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            ⬇️ Descargar
          </button>
          <button
            onClick={function(){
              const base64 = btoa(unescape(encodeURIComponent(preview)));
              const dataUrl = "data:text/html;base64," + base64;
              try {
                navigator.clipboard.writeText(dataUrl).then(function(){
                  setToast("✓ Link copiado — pégalo en Safari");
                  setTimeout(function(){setToast(null);}, 2500);
                }).catch(function(){
                  // Fallback: use textarea trick
                  const ta = document.createElement("textarea");
                  ta.value = dataUrl;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  document.body.appendChild(ta);
                  ta.focus();
                  ta.select();
                  try {
                    document.execCommand("copy");
                    setToast("✓ Link copiado — pégalo en Safari");
                  } catch(e) {
                    setToast("✗ No se pudo copiar automáticamente");
                  }
                  document.body.removeChild(ta);
                  setTimeout(function(){setToast(null);}, 2500);
                });
              } catch(e) {
                setToast("✗ No se pudo copiar automáticamente");
                setTimeout(function(){setToast(null);}, 2500);
              }
            }}
            style={{background:"#444",border:"1px solid #666",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            📋 Copiar link para Safari
          </button>
          <button
            onClick={function(){ setShowOrden(true); }}
            style={{background:"#2a6a4a",border:"1px solid #3a8a5a",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            🏭 Proceder a Orden
          </button>
        </div>
        <button onClick={function(){setPreview(null);}} style={{background:"rgba(255,80,80,.2)",border:"1px solid rgba(255,80,80,.4)",borderRadius:8,padding:"7px 16px",color:"#ff8080",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          ✕ Volver
        </button>
      </div>
      {showOrden && (
        <OrdenProduccion
          pieces={enrichedPieces}
          telas={telas}
          confecciones={confecciones}
          rielesCustom={rielesCustom}
          cliente={cliente}
          numCotizacion={numCotizacion}
          empresa={empresa}
          ordenData={ordenData}
          setOrdenData={setOrdenData}
          onClose={function(){ setShowOrden(false); }}
          onSacarOrden={handleSacarOrden}
        />
      )}
      <iframe id="preview-iframe" srcDoc={preview} style={{flex:1,border:"none",background:"#fff"}} title="Cotización TBC"/>
    </div>
  );

  return(
    <div style={S.wrap}>
      {loadingQR&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#1a1a1a",border:"1px solid #333",borderRadius:14,padding:"24px 32px",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:10}}>⏳</div>
            <div style={{color:"#fff",fontWeight:600,fontSize:13}}>Generando cotización...</div>
          </div>
        </div>
      )}
      {toast&&(
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:"#1a1a1a",border:"1px solid #333",borderRadius:10,padding:"12px 24px",color:"#fff",fontSize:13,fontWeight:600,zIndex:99999,boxShadow:"0 4px 20px rgba(0,0,0,.4)",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}
      <div style={S.header}>
        {empresa==="VIVENDI" ? <VivendiLogo/> : <TBCLogo/>}
        <div style={{marginLeft:16,borderLeft:"1px solid #e8e8e8",paddingLeft:20,flex:1}}>
          <div style={{fontSize:11,color:"#999",letterSpacing:1.5,textTransform:"uppercase",fontWeight:500}}>Cotizador</div>
        </div>
        <button
          onClick={function(){setEmpresa("");}}
          style={{background:"transparent",border:"1px solid #ddd",borderRadius:8,padding:"6px 12px",color:"#999",fontSize:11,cursor:"pointer"}}
        >
          Cambiar empresa
        </button>
        <button
          onClick={function(){fileInputRef.current && fileInputRef.current.click();}}
          disabled={loadingQR}
          style={{background:"transparent",border:"1px solid #555",borderRadius:8,padding:"6px 12px",color:"#aaa",fontSize:11,cursor:"pointer",opacity:loadingQR?0.5:1}}
          title="Cargar cotización desde PDF"
        >
          {loadingQR?"⏳":"📂"} Cargar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{display:"none"}}
          onChange={handleLoadFromFile}
        />
      </div>
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.sectionLabel}>👤 Datos del Cliente</div>
          <div style={{...S.g2,marginBottom:14}}>
            <div style={S.field}><div style={S.lbl}>Nombre</div><input style={S.inp} value={cliente.nombre} onChange={function(e){updateCliente("nombre",e.target.value);}} placeholder="Juan"/></div>
            <div style={S.field}><div style={S.lbl}>Apellido</div><input style={S.inp} value={cliente.apellido} onChange={function(e){updateCliente("apellido",e.target.value);}} placeholder="Pérez"/></div>
            <div style={S.field}><div style={S.lbl}>Email</div><input style={S.inp} value={cliente.email} onChange={function(e){updateCliente("email",e.target.value);}} placeholder="cliente@email.com"/></div>
            <div style={S.field}><div style={S.lbl}>Teléfono</div><input style={S.inp} value={cliente.telefono} onChange={function(e){updateCliente("telefono",e.target.value);}} placeholder="+507 6000-0000"/></div>
          </div>
          <div style={S.field}><div style={S.lbl}>Dirección</div><input style={S.inp} value={cliente.direccion} onChange={function(e){updateCliente("direccion",e.target.value);}} placeholder="Ciudad de Panamá"/></div>
        </div>

        <div style={S.sectionLabel}>🪟 Piezas a Cotizar</div>
        {enrichedPieces.map(function(p,i){return(
          <PieceCard key={p.id} p={p} idx={i} onChange={function(v,action){updatePiece(i,v,action);}} onRemove={function(){removePiece(i);}} telas={telas} setTelas={setTelas} confecciones={confecciones} setConfecciones={setConfecciones} rielesCustom={rielesCustom} setRielesCustom={setRielesCustom} motoresCustom={motoresCustom} setMotoresCustom={setMotoresCustom} controlesCustom={controlesCustom} setControlesCustom={setControlesCustom} cenefasCustom={cenefasCustom} setCenefasCustom={setCenefasCustom} makePendingHandler={makePendingHandler}/>
        );})}
        <div style={S.pieceAddBtn} onClick={function(){setPieces(function(ps){return[...ps,newPiece()];});}}>+ Agregar Pieza</div>

        <div style={{...S.card,marginTop:20,borderColor:"rgba(76,175,125,.2)"}}>
          <ExtrasSection extras={globalExtras} onChange={setGlobalExtras} onPendingChange={setExtrasPendiente}/>
        </div>

        <div style={{...S.card,marginTop:8,borderColor:"rgba(201,168,76,.4)"}}>
          <div style={S.sectionLabel}>💰 Resumen y Totales</div>
          <PiecesSummary pieces={enrichedPieces} telas={telas} confecciones={confecciones} rielesCustom={rielesCustom}/>
          <GlobalExtrasSummary extras={globalExtras}/>
          <div style={S.divider}/>
          <div style={{...S.priceRow,marginBottom:8}}><span style={{color:C.text,fontWeight:600}}>Subtotal</span><span style={{color:C.goldL,fontWeight:700}}>{fmt(subtotalBruto)}</span></div>
          <div style={{...S.g3,marginBottom:10,alignItems:"flex-end"}}>
            <div style={S.field}>
              <div style={S.lbl}>Descuento extra (%)</div>
              <input type="number" step="0.1" style={S.inp} value={descuento||""}
                onChange={function(e){setDescuento(e.target.value===""?0:parseFloat(e.target.value)||0);}}
                onBlur={function(e){const v=parseFloat(e.target.value);setDescuento(isNaN(v)?0:v);}}
                placeholder="0"/>
              <div style={S.tip}>Solo si aplica</div>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>Viático ($) — sin ITBMS</div>
              <input type="number" style={S.inp} value={viatico}
                onChange={function(e){setViatico(e.target.value===""?0:parseFloat(e.target.value)||0);}}
                onBlur={function(e){const v=parseFloat(e.target.value);setViatico(isNaN(v)?0:v);}}
                placeholder="0.00"/>
            </div>
            <div style={S.field}>
              <div style={S.lbl}>ITBMS (%)</div>
              <input type="number" style={S.inp} value={itbms}
                onChange={function(e){setItbms(e.target.value===""?0:parseFloat(e.target.value)||0);}}
                onBlur={function(e){const v=parseFloat(e.target.value);setItbms(isNaN(v)?0:v);}}
                placeholder="7"/>
            </div>
          </div>
          {descuento>0&&<div style={{...S.priceRow,color:"#4CAF7D"}}><span>Descuento extra ({descuento}%)</span><span>- {fmt(descuentoAmt)}</span></div>}
          {descuento>0&&<div style={S.priceRow}><span>Subtotal con descuento</span><span>{fmt(grandTotal)}</span></div>}
          {viatico>0&&<div style={S.priceRow}><span>Viático</span><span>{fmt(viatico)}</span></div>}
          <div style={S.priceRow}><span>ITBMS ({itbms}%)</span><span>{fmt(itbmsAmt)}</span></div>
          <div style={S.totalRow}><span>TOTAL FINAL</span><span>{fmt(totalFinal)}</span></div>
          <div style={{fontSize:10,color:"#888",marginTop:6}}>* Válido por 30 días. Precios en USD.</div>
          <div style={S.divider}/>
          <div style={S.field}>
            <div style={S.lbl}>💬 Comentarios / Notas adicionales</div>
            <textarea
              style={{...S.inp,minHeight:80,resize:"vertical",fontFamily:"inherit",lineHeight:1.6}}
              placeholder="Ej: Incluye garantía de 1 año, tiempo de entrega estimado 15 días hábiles..."
              value={comentarios}
              onChange={function(e){setComentarios(e.target.value);}}
            />
          </div>
        </div>

        {(function(){
          const invalidPieces=pieces.filter(function(p){return !isPieceValid(p,telas);});
          const hayErrores=invalidPieces.length>0||extrasPendiente||hayCustomPendiente;
          if(hayErrores){
            return(
              <div style={{marginTop:20}}>
                <div style={{background:"rgba(224,85,85,.1)",border:"1px solid rgba(224,85,85,.3)",borderRadius:12,padding:"14px 18px",marginBottom:10}}>
                  <div style={{color:"#E05555",fontWeight:700,fontSize:13,marginBottom:8}}>⚠ Corrige lo siguiente antes de generar la cotización:</div>
                  {invalidPieces.map(function(p){
                    const errs=validatePiece(p,telas);
                    const idx=pieces.indexOf(p);
                    return(
                      <div key={p.id} style={{fontSize:12,color:"#ff8080",marginBottom:4}}>
                        <strong>Pieza #{idx+1} {p.area?"("+p.area+")":""}</strong>: {Object.values(errs).join(", ")}
                      </div>
                    );
                  })}
                  {extrasPendiente&&(
                    <div style={{fontSize:12,color:"#ff8080",marginTop:invalidPieces.length>0?8:0}}>
                      <strong>Artículos extras:</strong> Hay un artículo en proceso que no fue agregado. Tocá "Agregar" para confirmarlo o borrá lo que escribiste.
                    </div>
                  )}
                  {hayCustomPendiente&&(
                    <div style={{fontSize:12,color:"#ff8080",marginTop:(invalidPieces.length>0||extrasPendiente)?8:0}}>
                      <strong>Producto personalizado:</strong> Hay un motor, control o cenefa personalizado en proceso que no fue agregado. Tocá "Confirmar agregar" o cancelá lo que escribiste.
                    </div>
                  )}
                </div>
                <button style={{...S.genBtn,marginTop:0,opacity:0.4,cursor:"not-allowed"}} disabled>
                  📄 Ver Cotización PDF
                </button>
              </div>
            );
          }
          return(
            <button style={{...S.genBtn,marginTop:20}} onClick={handleDownloadPDF}>
              📄 Ver Cotización PDF
            </button>
          );
        })()}
      </div>
    </div>
  );
}
