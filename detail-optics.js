// Measured against two original artworks in the supplied references.
// Colour fit excludes the game's controls; the webpage does not render them.
export const DETAIL_OPTICS=Object.freeze({"matrix":[[0.9610630179035301,-0.045915699170603466,0.08290646549368808],[0.04709528023070579,0.8799894517017988,0.07865983198667259],[0.09409677544271765,-0.11649006959043068,1.021559889116477]],"bias":[-0.010579989499090142,-0.007960492314472156,-0.010143190610614222],"vignette":0.52});
export const IDENTITY_MATRIX=[1,0,0,0,1,0,0,0,1];
export function matrixColumns(rows){return [rows[0][0],rows[1][0],rows[2][0],rows[0][1],rows[1][1],rows[2][1],rows[0][2],rows[1][2],rows[2][2]];}
