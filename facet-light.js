// Motion in units of the shared triangle lattice, independent of camera zoom.
// The third noise axis changes shape while the field travels, rather than
// giving each fixed face its own repeating brightness oscillator.
export const FACET_MOTION={velocity:[.10,.82],scale:2.35,evolution:.32,cutoff:.59,ceiling:1.,gain:.58};
const glFloat=value=>value.toFixed(8);
export const FACET_FIELD=`
float facetHash(vec3 p){
 p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
}
float facetNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 float a=mix(mix(facetHash(i),facetHash(i+vec3(1.,0.,0.)),f.x),mix(facetHash(i+vec3(0.,1.,0.)),facetHash(i+vec3(1.,1.,0.)),f.x),f.y);
 float b=mix(mix(facetHash(i+vec3(0.,0.,1.)),facetHash(i+vec3(1.,0.,1.)),f.x),mix(facetHash(i+vec3(0.,1.,1.)),facetHash(i+vec3(1.,1.,1.)),f.x),f.y);
 return mix(a,b,f.z);
}
float movingFacetLight(vec2 center,float cell,float time){
 vec2 axial=vec2(center.x/cell-center.y/(cell*1.7320508),center.y/(cell*.8660254));
 vec2 velocity=vec2(${glFloat(FACET_MOTION.velocity[0])}-${glFloat(FACET_MOTION.velocity[1])}/1.7320508,${glFloat(FACET_MOTION.velocity[1])}/.8660254);
 vec3 point=vec3((axial-velocity*time)/${glFloat(FACET_MOTION.scale)},time*${glFloat(FACET_MOTION.evolution)}+.271);
 return smoothstep(${glFloat(FACET_MOTION.cutoff)},${glFloat(FACET_MOTION.ceiling)},facetNoise(point))*${glFloat(FACET_MOTION.gain)};
}`;
