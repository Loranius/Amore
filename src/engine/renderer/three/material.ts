import * as THREE from 'three';
import type { CrystalBodyMaterial, CrystalRgb, CrystalShaderRecipe } from '../../material';
import { crystalSurfaceTextures } from './surfaceTextures';

function toColor(color: CrystalRgb): THREE.Color {
  return new THREE.Color().setRGB(color.r, color.g, color.b);
}

function rgbKey(color: CrystalRgb): string {
  return `${color.r.toFixed(6)},${color.g.toFixed(6)},${color.b.toFixed(6)}`;
}

function shaderKey(recipe: CrystalShaderRecipe): string {
  return [
    recipe.shaderVersion,
    recipe.rimStrength.toFixed(6),
    recipe.skyStrength.toFixed(6),
    rgbKey(recipe.skyColor),
    rgbKey(recipe.groundColor),
    rgbKey(recipe.rimColor),
    recipe.inclusionDensity.toFixed(6),
    recipe.inclusionScale.toFixed(6),
    recipe.inclusionContrast.toFixed(6),
    recipe.coreStrength.toFixed(6),
    rgbKey(recipe.coreColor),
    recipe.glassStrength.toFixed(6),
    recipe.veilStrength.toFixed(6),
    recipe.veilScale.toFixed(6),
    recipe.auroraStrength.toFixed(6),
    rgbKey(recipe.auroraColor),
    rgbKey(recipe.auroraSecondColor),
    recipe.auroraDepth.toFixed(6),
    recipe.surfaceTextureScale.toFixed(6),
    recipe.surfaceReliefStrength.toFixed(6),
    recipe.surfaceVeinStrength.toFixed(6),
    recipe.facetEdgeStrength.toFixed(6),
    recipe.facetEdgeWidth.toFixed(6),
    recipe.axialTintStrength.toFixed(6),
    rgbKey(recipe.footColor),
    recipe.innerFlowStrength.toFixed(6),
    recipe.innerFlowTurns.toFixed(6),
    rgbKey(recipe.innerFlowColor),
    rgbKey(recipe.innerFlowSecondColor),
  ].join('|');
}

/**
 * The vertex side: object-space position and normal, carried to the fragment
 * shader.
 *
 * Object space, not view space, and that is a correction rather than a
 * preference. The inclusion field this replaces was keyed on `vViewPosition`,
 * so the "inclusions" slid through the stone as the camera orbited — a texture
 * that moves with the viewer is a screen effect, not a texture. In object space
 * the pattern is *in* the crystal: it turns with it and stays put.
 *
 * The normal comes along because the striation mask needs to know which faces
 * are shaft and which are termination, and `vNormal` is in view space.
 */
const VERTEX_PARS = /* glsl */ `
varying vec3 vEvolutionObject;
varying vec3 vEvolutionObjectNormal;
attribute vec3 evolutionEdge;
varying vec3 vEvolutionEdge;
attribute float evolutionAxial;
varying float vEvolutionAxial;
attribute vec3 evolutionBodyCoord;
varying vec3 vEvolutionBodyCoord;
`;

const VERTEX_BODY = /* glsl */ `
  vEvolutionObject = position;
  vEvolutionObjectNormal = normal;
  vEvolutionEdge = evolutionEdge;
  vEvolutionAxial = evolutionAxial;
  vEvolutionBodyCoord = evolutionBodyCoord;
`;

const FRAGMENT_PARS = /* glsl */ `
uniform float uEvolutionRimStrength;
uniform float uEvolutionSkyStrength;
uniform vec3 uEvolutionSkyColor;
uniform vec3 uEvolutionGroundColor;
uniform vec3 uEvolutionRimColor;
uniform float uEvolutionInclusionDensity;
uniform float uEvolutionInclusionScale;
uniform float uEvolutionInclusionContrast;
uniform float uEvolutionCoreStrength;
uniform vec3 uEvolutionCoreColor;
uniform float uEvolutionGlassStrength;
uniform float uEvolutionVeilStrength;
uniform float uEvolutionVeilScale;
uniform float uEvolutionAuroraStrength;
uniform vec3 uEvolutionAuroraColor;
uniform vec3 uEvolutionAuroraSecondColor;
uniform float uEvolutionAuroraDepth;
uniform float uEvolutionPhase;
uniform float uEvolutionFacetEdgeStrength;
uniform float uEvolutionFacetEdgeWidth;
uniform float uEvolutionAxialTintStrength;
uniform vec3 uEvolutionFootColor;
uniform float uEvolutionInnerFlowStrength;
uniform float uEvolutionInnerFlowTurns;
uniform float uEvolutionInnerFlowPhase;
uniform vec3 uEvolutionInnerFlowColor;
uniform vec3 uEvolutionInnerFlowSecondColor;
varying float vEvolutionAxial;
varying vec3 vEvolutionObject;
varying vec3 vEvolutionObjectNormal;
varying vec3 vEvolutionEdge;
varying vec3 vEvolutionBodyCoord;

float evolutionHash( vec3 cell ) {
  return fract( sin( dot( cell, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453123 );
}

// Value noise. Chosen over gradient noise deliberately: it is half the
// instructions, and what it is asked for here is cloud rather than terrain.
float evolutionNoise( vec3 point ) {
  vec3 cell = floor( point );
  vec3 offset = fract( point );
  offset = offset * offset * ( 3.0 - 2.0 * offset );
  float c000 = evolutionHash( cell );
  float c100 = evolutionHash( cell + vec3( 1.0, 0.0, 0.0 ) );
  float c010 = evolutionHash( cell + vec3( 0.0, 1.0, 0.0 ) );
  float c110 = evolutionHash( cell + vec3( 1.0, 1.0, 0.0 ) );
  float c001 = evolutionHash( cell + vec3( 0.0, 0.0, 1.0 ) );
  float c101 = evolutionHash( cell + vec3( 1.0, 0.0, 1.0 ) );
  float c011 = evolutionHash( cell + vec3( 0.0, 1.0, 1.0 ) );
  float c111 = evolutionHash( cell + vec3( 1.0, 1.0, 1.0 ) );
  return mix(
    mix( mix( c000, c100, offset.x ), mix( c010, c110, offset.x ), offset.y ),
    mix( mix( c001, c101, offset.x ), mix( c011, c111, offset.x ), offset.y ),
    offset.z
  );
}

// Two octaves. A third costs another eight texture-free lookups and is not
// visible at the size a crystal occupies on a phone.
float evolutionVeil( vec3 point ) {
  return evolutionNoise( point ) * 0.65 + evolutionNoise( point * 2.17 ) * 0.35;
}
`;

/**
 * Surface texture, injected where roughness is decided rather than where light
 * is summed — a striation that only tinted the outgoing colour would read as
 * dirt on the crystal instead of as a change in how it catches light.
 *
 * Both fields also thin or thicken the stone: veiled quartz is cloudier and
 * lets less through, which is what makes the transparency read as depth rather
 * than as a flat percentage.
 */
const FRAGMENT_ROUGHNESS = /* glsl */ `
  // Veils are flattened along the vertical: a plane of fluid inclusions is a
  // lens, not a blob, and stretching the sample the other way is what turns
  // noise into something with a grain direction.
  float evolutionCloud = uEvolutionVeilStrength > 0.0001
    ? evolutionVeil( vEvolutionObject * vec3( uEvolutionVeilScale, uEvolutionVeilScale * 2.6, uEvolutionVeilScale ) )
    : 0.5;

  roughnessFactor = clamp(
    roughnessFactor + ( evolutionCloud - 0.5 ) * uEvolutionVeilStrength * 0.5,
    0.02,
    1.0
  );

  // Cloudier stone is less see-through. Only ever closes the shell, never opens
  // it: a crystal that went clearer than the material asked for would lose the
  // facets the geometry exists to draw.
  diffuseColor.a = clamp(
    diffuseColor.a + ( evolutionCloud - 0.5 ) * uEvolutionVeilStrength * 0.3,
    diffuseColor.a,
    1.0
  );
`;

const FRAGMENT_BODY = /* glsl */ `
  vec3 evolutionViewDir = normalize( vViewPosition );
  float evolutionFacing = clamp( dot( normal, evolutionViewDir ), 0.0, 1.0 );
  float evolutionFresnel = pow( 1.0 - evolutionFacing, 5.0 );
  vec3 evolutionReflected = reflect( -evolutionViewDir, normal );
  float evolutionUpness = clamp( evolutionReflected.y * 0.5 + 0.5, 0.0, 1.0 );

  // Steepened deliberately: a prism's faces are all near-vertical, so their
  // reflected rays are all near-horizontal and a linear up/down mix hands every
  // one of them the same colour. Pushing the gradient makes the small
  // differences between facets into visible ones, which is what a reflection is
  // for.
  evolutionUpness = smoothstep( 0.25, 0.75, evolutionUpness );
  vec3 evolutionSky = mix( uEvolutionGroundColor, uEvolutionSkyColor, evolutionUpness );
  // No constant floor. It used to be a quarter plus three quarters of the
  // Fresnel, and that quarter was added to every facet alike — a uniform lift wearing a reflection's name.
  // Measured on the live portal it was a large part of why four neighbouring
  // faces rendered within 9% of each other: the shell sat so high on the tone
  // curve that a four-to-one difference in incoming light compressed to nothing.
  // Reflection belongs at the silhouette, where reflectance actually climbs.
  outgoingLight += evolutionSky * uEvolutionSkyStrength * evolutionFresnel;
  outgoingLight += uEvolutionRimColor * uEvolutionRimStrength * evolutionFresnel;

  // ── Zoning inside the stone ───────────────────────────────
  // The band itself is unchanged; where it is applied is not, and that is the
  // whole of this. It used to multiply the shaded result — the outgoing light,
  // specular highlight included — which is what a stain on the *surface* does.
  // A cloud inside quartz is not a stain: it is a region that scatters the
  // light crossing it, so what it changes is the light coming from within.
  //
  // Measured before the move, by zeroing each term in turn and diffing the
  // portal: the inclusion moved 0.42 of 255 on average, over 7% of the
  // artifact's pixels. Pass 1's "no zoning, no inclusion depth at portal size"
  // was that number. It was not too weak a constant — it was applied where the
  // eye reads dirt rather than depth, and no amount of it would have become
  // structure.
  //
  // The band is dropped from the surface entirely rather than kept at a lower
  // weight. A fracture that shows on the outside is a real habit, but it is not
  // this term, and two mechanisms sharing one number is how the last four
  // passes' dead code came about.
  float evolutionBand = sin(
    dot( vEvolutionObject, vec3(0.83, 1.17, 0.61) ) * uEvolutionInclusionScale
    + dot( vEvolutionObjectNormal, vec3(2.1, 1.3, 1.7) )
  );
  float evolutionZone = evolutionBand * 0.5 + 0.5;
  // Zones, not veins. The old term thresholded this at 1 − density, and with a
  // measured density of 0.111 that kept the top eighth of the range: thin
  // filaments, which is what an inclusion *trail* looks like and not what
  // zoning looks like. Sharpening toward the boundary instead keeps the whole
  // body inside a zone of one kind or another, which is how a quartz crystal is
  // actually built — it grew in stages and every part of it belongs to one.
  evolutionZone = mix(
    evolutionZone,
    smoothstep( 0.35, 0.65, evolutionZone ),
    uEvolutionInclusionContrast
  );
  float evolutionInclusion = uEvolutionInclusionDensity > 0.0001
    ? ( evolutionZone - 0.5 ) * 2.0 * uEvolutionInclusionDensity
    : 0.0;

  // Veils lift toward milk rather than toward grey: a cloud inside quartz
  // scatters light, it does not absorb it.
  outgoingLight = mix(
    outgoingLight,
    outgoingLight * 0.78 + vec3( 0.17, 0.16, 0.2 ),
    clamp( ( evolutionCloud - 0.45 ) * uEvolutionVeilStrength * 0.8, 0.0, 0.32 )
  );

  // ── Glass ─────────────────────────────────────────────────
  // Everything below is one fact: reflectance climbs toward the silhouette.
  //
  // The alpha closes at the edge and opens face-on. That view-dependence is
  // what separates glass from fog — a constant alpha reads as a body made of
  // mist however low it is set, because real glass is only see-through where
  // you are looking straight through it. It also gives the crystal back a hard
  // outline, which is what lets the alpha go lower than it otherwise could.
  float evolutionGlassEdge = pow( 1.0 - evolutionFacing, 3.0 );
  diffuseColor.a = clamp(
    mix( diffuseColor.a, 1.0, evolutionGlassEdge * uEvolutionGlassStrength ),
    0.0,
    1.0
  );

  // Light crossing the body at an angle travels further through it and comes
  // out carrying more of what the stone is made of. Beer-Lambert without a
  // transmission buffer to measure a real path in: the grazing angle is the
  // path length. This is where the colour a couple earned actually shows —
  // deep in the body rather than painted on the shell.
  //
  // Normalised to its own brightest channel, so it carries hue without also
  // carrying loss. Multiplying by the core colour raw darkened every grazing
  // face toward the colour instead of tinting it, and on a dark stage that read
  // as the crystal going muddy rather than as depth.
  vec3 evolutionDepthTint = uEvolutionCoreColor / max(
    0.25,
    max( uEvolutionCoreColor.r, max( uEvolutionCoreColor.g, uEvolutionCoreColor.b ) )
  );
  outgoingLight = mix(
    outgoingLight,
    outgoingLight * evolutionDepthTint * 1.06,
    ( 1.0 - evolutionFacing ) * uEvolutionGlassStrength * 0.45
  );

  // And the edge lights up exactly where it stopped being transparent, which is
  // the same term arriving as reflection rather than as opacity.
  outgoingLight += uEvolutionRimColor * evolutionFresnel * uEvolutionGlassStrength * 0.55;

  // ── Foot to tip ───────────────────────────────────────────
  // Every stylized reference crystal changes colour along its length: one hue
  // where it left the rock, another at the point. It is a real habit — a
  // phantom, or a change in what the fluid carried while the crystal grew — and
  // it is a large part of why a reference gem reads as grown rather than
  // moulded. A body of one flat colour reads as moulded however well it is lit.
  //
  // Both ends come from the couple. The foot takes the deepened core colour,
  // which is what the granted wishes made (ADR-0004); the tip keeps the shell's
  // own. So the gradient is the earned colour changing depth along the crystal,
  // never a second colour introduced from outside it.
  if ( uEvolutionAxialTintStrength > 0.0001 ) {
    // Weighted toward the foot: a phantom sits low and fades out, it does not
    // meet the tip halfway.
    float evolutionFoot = pow( 1.0 - clamp( vEvolutionAxial, 0.0, 1.0 ), 1.8 );
    outgoingLight = mix(
      outgoingLight,
      outgoingLight * uEvolutionFootColor,
      evolutionFoot * uEvolutionAxialTintStrength
    );
  }

  // ── The facet's own rim ───────────────────────────────────
  // Drawn, not lit, and that is the whole point. Three stylized gem assets the
  // owner supplied all outline every facet in the surface itself — in albedo,
  // in roughness and in emissive at once, and the handpainted pack does it with
  // no lighting model whatsoever. Measurement here agreed from the other side:
  // with the key light switched off the monarch's facets moved by about 3%, so
  // no amount of lighting was ever going to separate them.
  //
  // Screen-space derivatives keep the line one pixel wide wherever it lands, so a
  // facet at the silhouette gets the same rim as one facing the viewer, and a
  // year crystal the same rim as the monarch. A rim measured in object space
  // would thicken as the body shrinks until a small crystal was nothing but
  // outline.
  if ( uEvolutionFacetEdgeStrength > 0.0001 ) {
    // Floored, and not defensively: a suppressed edge carries 1 at all three
    // corners, so its derivative is exactly zero and an unfloored smoothstep
    // divides by it. The NaN that produces does not stay local — min() carries
    // it across the whole facet, which renders as speckled noise over the body.
    vec3 edgeWidth = max( fwidth( vEvolutionEdge ) * uEvolutionFacetEdgeWidth, vec3( 1e-5 ) );
    vec3 edgeFalloff = smoothstep( vec3( 0.0 ), edgeWidth, vEvolutionEdge );
    float evolutionRim = 1.0 - min( min( edgeFalloff.x, edgeFalloff.y ), edgeFalloff.z );
    outgoingLight += uEvolutionRimColor * evolutionRim * uEvolutionFacetEdgeStrength;
  }

  // ── Aurora in the fissure ─────────────────────────────────
  // Only the vein carries this, and only below its lip: the seam is a crack the
  // crystals came out of, and what makes it read as their source rather than as
  // a moulding is that something is lit down there.
  //
  // Two colours drifting against each other at different rates. One hue at one
  // brightness is a bulb in a slot however slowly it moves; an aurora is two
  // sheets sliding over one another, and the interference between them is the
  // whole effect.
  if ( uEvolutionAuroraStrength > 0.0001 ) {
    // Depth into the crack, from the lip down. Nothing above the lip glows, so
    // the light stays in the fissure instead of washing the whole seam.
    float evolutionDepth = clamp(
      -vEvolutionObject.y / max( 1e-4, uEvolutionAuroraDepth ),
      0.0,
      1.0
    );
    float evolutionAcross = vEvolutionObject.x * 5.5 + vEvolutionObject.z * 4.1;
    float evolutionSheetA = sin( evolutionAcross + uEvolutionPhase * 6.2831 ) * 0.5 + 0.5;
    float evolutionSheetB = sin(
      evolutionAcross * 0.62 - uEvolutionPhase * 4.1 + evolutionCloud * 3.4
    ) * 0.5 + 0.5;
    vec3 evolutionCurtain = mix(
      uEvolutionAuroraColor,
      uEvolutionAuroraSecondColor,
      evolutionSheetB
    );
    // Banded rather than smooth: an aurora has edges, and a smooth ramp over a
    // surface this small reads as a coloured wash.
    //
    // The magnitudes below are large next to the rest of this shader, and they
    // have to be: the fissure is a small, deeply shadowed part of a dark scene,
    // and at the tenth-scale this started at the curtain was arithmetically
    // present and visually absent. Checked by amplifying it fifteen-fold, which
    // lit the seam plainly — so the term was never wrong, only inaudible.
    float evolutionBandK = smoothstep( 0.35, 0.95, evolutionSheetA * 0.7 + evolutionSheetB * 0.3 );
    outgoingLight += evolutionCurtain
      * uEvolutionAuroraStrength
      * evolutionDepth
      * ( 1.4 + 4.6 * evolutionBandK );
  }

  // Light from inside the stone. The shell's own emission raises every plane by
  // the same amount and flattens the relief; this is weighted by how squarely a
  // face meets the eye, which stands in for how much crystal lies behind it.
  // Faces turned toward the viewer glow, faces at the silhouette do not — and
  // since every triangle carries its own normal, neighbouring facets separate
  // instead of merging.
  float evolutionInner = evolutionFacing * evolutionFacing * evolutionFacing;

  // And this is where the stone's zoning and its cloud arrive: on the inner
  // light, not on the surface. Both *lift* it. Milky quartz is white because a
  // cloud scatters the light crossing it back out — the veil block above says
  // the same thing about the shell — so a zone the couple's history clouded
  // reads as brighter from within, never as a dark patch.
  //
  // Weighting them by the inner light rather than adding them flat is what
  // makes this depth rather than paint: both fade to nothing at the silhouette,
  // where there is no stone between the eye and the far side to hold anything.
  // A flat addition would have drawn the same pattern on a face seen edge-on,
  // which is the one place a real inclusion cannot show.
  float evolutionZoning = 1.0
    + evolutionInclusion
    + ( evolutionCloud - 0.5 ) * uEvolutionVeilStrength * 0.9;

  outgoingLight += uEvolutionCoreColor
    * uEvolutionCoreStrength
    * evolutionInner
    * max( 0.0, evolutionZoning );

  // ── Energy turning inside the monarch ─────────────────────
  // The one thing in the colony that moves, and the one body that has it. Every
  // other optical term here says what the stone is made of; this says that
  // something is alive in the middle of it.
  //
  // It cannot be a second mesh. The shell is opaque by contract — the canvas is
  // alpha-composited over a CSS sky, so a transmissive body shows black where
  // it overlaps the sky rather than the sky itself (ADR-0007) — so anything
  // inside the crystal has to be drawn by the shell's own fragments, as light
  // arriving from behind them.
  if ( uEvolutionInnerFlowStrength > 0.0001 ) {
    // The body's own frame: x and z in −1..1 across its widest slice, y from 0
    // at the foot to 1 at the tip. Published by the geometry engine
    // (CrystalMeshData.bodyCoord) rather than derived from position here,
    // and it has to be: the batch's instance matrices are identity, so
    // position is artifact space and a body's own centre, height and girth
    // are not recoverable from it. The frame also divides x and z by the *same*
    // span, so an elliptical cross-section does not map onto a circle and send
    // the flow wandering off-centre as the crystal turns.
    vec3 evolutionBody = vEvolutionBodyCoord;

    // Where the eye is, in that frame's horizontal plane. Nothing between the
    // body and the world carries a rotation — instance matrices are identity
    // and the artifact group only scales and lifts — so world XZ is body XZ, to
    // within the few degrees of lean each crystal's habit gives it.
    vec3 evolutionWorldView = inverseTransformDirection( evolutionViewDir, viewMatrix );
    vec2 evolutionViewXZ = normalize( evolutionWorldView.xz + vec2( 1e-4, 1e-4 ) );
    float evolutionAzimuth = atan( evolutionViewXZ.y, evolutionViewXZ.x );

    // A real helix rather than a screen pattern: at height y it stands at
    // azimuth 2π(turns·y + phase), so it climbs the body and drifts around it.
    // rel is where that stretch of it lies relative to the viewer, which is
    // the only quantity the two lines below need.
    float evolutionCoil = 6.2831
      * ( uEvolutionInnerFlowTurns * evolutionBody.y + uEvolutionInnerFlowPhase );
    float evolutionRel = evolutionCoil - evolutionAzimuth;

    // Both the ribbon and this fragment, measured on the one axis that matters:
    // horizontally across the line of sight. sin(rel) is exactly where the
    // helix crosses that axis at this height.
    float evolutionFlowCenter = sin( evolutionRel ) * 0.52;
    float evolutionScreenSide =
      evolutionBody.z * evolutionViewXZ.x - evolutionBody.x * evolutionViewXZ.y;
    float evolutionFlowBand = 1.0 - smoothstep(
      0.0,
      0.42,
      abs( evolutionScreenSide - evolutionFlowCenter )
    );

    // Behind the front facet, which is the whole of why this reads as depth.
    // cos(rel) is positive on the near half of every turn and negative on the
    // far half; only the far half has stone in front of it. Keeping the near
    // half would paint the ribbon onto the surface, which is the failure this
    // term exists to prevent — and it is also what makes the flow correct
    // through 360°, since the half that is dropped changes as the couple
    // turns the portal.
    float evolutionBehind = 0.5 - 0.5 * cos( evolutionRel );

    // Nothing at the foot, which is buried in the vein, and nothing at the tip,
    // where the body is too narrow for anything to turn inside it.
    float evolutionFlowEnvelope = smoothstep( 0.06, 0.17, evolutionBody.y )
      * ( 1.0 - smoothstep( 0.84, 0.96, evolutionBody.y ) );

    // Rose into amethyst along the ribbon, so it flows instead of sitting there
    // as a bar of one colour. Both ends are the palette's own family and the
    // mix cannot leave it.
    vec3 evolutionFlowColor = mix(
      uEvolutionInnerFlowColor,
      uEvolutionInnerFlowSecondColor,
      0.5 + 0.5 * sin( evolutionRel * 0.5 + evolutionBody.y * 4.1 )
    );

    outgoingLight += evolutionFlowColor
      * uEvolutionInnerFlowStrength
      * evolutionFlowEnvelope
      * evolutionFlowBand
      * evolutionBehind
      // Weighted by how squarely the facet meets the eye, for the same reason
      // the core light is: a facet at the silhouette has no stone behind it to
      // carry a glow, so drawing one there would put the flow *on* the crystal
      // rather than in it.
      * evolutionInner;
  }
`;

function applyEvolutionShader(material: THREE.MeshPhysicalMaterial, recipe: CrystalBodyMaterial['shader']): void {
  if (
    recipe.rimStrength <= 0
    && recipe.skyStrength <= 0
    && recipe.inclusionDensity <= 0
    && recipe.coreStrength <= 0
    && recipe.veilStrength <= 0
    && recipe.glassStrength <= 0
    && recipe.auroraStrength <= 0
    && recipe.facetEdgeStrength <= 0
    && recipe.axialTintStrength <= 0
    && recipe.innerFlowStrength <= 0
  ) return;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uEvolutionRimStrength'] = { value: recipe.rimStrength };
    shader.uniforms['uEvolutionSkyStrength'] = { value: recipe.skyStrength };
    shader.uniforms['uEvolutionSkyColor'] = { value: toColor(recipe.skyColor) };
    shader.uniforms['uEvolutionGroundColor'] = { value: toColor(recipe.groundColor) };
    shader.uniforms['uEvolutionRimColor'] = { value: toColor(recipe.rimColor) };
    shader.uniforms['uEvolutionInclusionDensity'] = { value: recipe.inclusionDensity };
    shader.uniforms['uEvolutionInclusionScale'] = { value: recipe.inclusionScale };
    shader.uniforms['uEvolutionInclusionContrast'] = { value: recipe.inclusionContrast };
    shader.uniforms['uEvolutionCoreStrength'] = { value: recipe.coreStrength };
    shader.uniforms['uEvolutionCoreColor'] = { value: toColor(recipe.coreColor) };
    shader.uniforms['uEvolutionGlassStrength'] = { value: recipe.glassStrength };
    shader.uniforms['uEvolutionVeilStrength'] = { value: recipe.veilStrength };
    shader.uniforms['uEvolutionVeilScale'] = { value: recipe.veilScale };
    shader.uniforms['uEvolutionAuroraStrength'] = { value: recipe.auroraStrength };
    shader.uniforms['uEvolutionAuroraColor'] = { value: toColor(recipe.auroraColor) };
    shader.uniforms['uEvolutionAuroraSecondColor'] = { value: toColor(recipe.auroraSecondColor) };
    shader.uniforms['uEvolutionAuroraDepth'] = { value: recipe.auroraDepth };
    shader.uniforms['uEvolutionPhase'] = { value: 0 };
    shader.uniforms['uEvolutionFacetEdgeStrength'] = { value: recipe.facetEdgeStrength };
    shader.uniforms['uEvolutionFacetEdgeWidth'] = { value: recipe.facetEdgeWidth };
    shader.uniforms['uEvolutionAxialTintStrength'] = { value: recipe.axialTintStrength };
    shader.uniforms['uEvolutionFootColor'] = { value: toColor(recipe.footColor) };
    shader.uniforms['uEvolutionInnerFlowStrength'] = { value: recipe.innerFlowStrength };
    shader.uniforms['uEvolutionInnerFlowTurns'] = { value: recipe.innerFlowTurns };
    shader.uniforms['uEvolutionInnerFlowPhase'] = { value: 0 };
    shader.uniforms['uEvolutionInnerFlowColor'] = { value: toColor(recipe.innerFlowColor) };
    shader.uniforms['uEvolutionInnerFlowSecondColor'] = {
      value: toColor(recipe.innerFlowSecondColor),
    };
    // Handed back so the life frame can advance it. Without a moving phase the
    // two colours sit still and the fissure is a lamp in a slot, not an aurora.
    material.userData['evolutionPhaseUniform'] = shader.uniforms['uEvolutionPhase'];
    // Its own clock, an order of magnitude slower than the sparkle's. Sharing
    // one would have spun the helix at the rate dust twinkles at, and the flow
    // would read as an animation playing on the crystal rather than as
    // convection inside it (`CrystalLifeState.innerFlowSpeed`).
    material.userData['evolutionInnerFlowPhaseUniform'] = shader.uniforms['uEvolutionInnerFlowPhase'];
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${VERTEX_PARS}\nvoid main() {`)
      // After `begin_vertex`, where `position` is still the untransformed
      // attribute — which is exactly the space the texture has to live in.
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAGMENT_PARS}\nvoid main() {`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${FRAGMENT_ROUGHNESS}`,
      )
      .replace('#include <opaque_fragment>', `${FRAGMENT_BODY}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `evolution-crystal:${shaderKey(recipe)}`;
  material.needsUpdate = true;
}

/** Thin renderer adapter. Optical decisions stay in Crystal Material State. */
export function createThreeCrystalMaterial(source: CrystalBodyMaterial): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: toColor(source.baseColor),
    emissive: toColor(source.emissiveColor),
    emissiveIntensity: source.emissiveIntensity,
    roughness: source.roughness,
    metalness: source.metalness,
    clearcoat: source.clearcoat,
    clearcoatRoughness: source.clearcoatRoughness,
    ior: source.ior,
    reflectivity: source.reflectivity,
    transmission: 0,
    opacity: source.opacity,
    transparent: source.transparent,
    depthWrite: source.depthWrite,
    // Off, and that is the point. Geometry now publishes one normal per
    // triangle (splitCrystalMeshFaces), so the facets are in the artifact.
    // Leaving flatShading on would have Three recompute normals from screen-
    // space derivatives and discard the published ones — the same picture, but
    // arrived at by ignoring the state instead of drawing it.
    flatShading: false,
    // Per-face tone rides in the geometry's colour attribute and multiplies
    // into this colour, so the body still renders as the colour the couple
    // earned — and, because it is geometry rather than material, bodies with
    // the same optical signature still share one draw call.
    vertexColors: true,
    envMapIntensity: source.envMapIntensity,
  });
  material.iridescence = source.iridescence;
  material.iridescenceIOR = source.iridescenceIOR;
  material.iridescenceThicknessRange = [
    source.iridescenceThicknessMin,
    source.iridescenceThicknessMax,
  ];
  // Surface maps. The coordinates are published in engine units, so `repeat`
  // is the density knob rather than a tiling count — see `surfaceTextureScale`.
  const maps = crystalSurfaceTextures(source.shader.surfaceTextureScale);
  if (maps !== null) {
    material.map = maps.surface;
    material.normalMap = maps.relief;
    material.normalScale = new THREE.Vector2(
      source.shader.surfaceReliefStrength,
      source.shader.surfaceReliefStrength,
    );
    if (source.shader.surfaceVeinStrength > 0) {
      material.emissiveMap = maps.veins;
      // The veins ride the body's own emissive colour, so what glows in the
      // cracks of the stone is the colour the couple earned rather than the
      // blue the map was authored in.
      material.emissiveIntensity = source.emissiveIntensity
        + source.shader.surfaceVeinStrength;
    }
  }

  material.userData['evolutionBodyId'] = source.bodyId;
  material.userData['evolutionSignature'] = source.signature;
  // The *effective* base, not the recipe's. A body carrying a vein map has had
  // its emissive raised to light that map, and the life frame rewrites this
  // property every frame as `base * glow` — so publishing the recipe's own
  // number here quietly undid the vein glow on the first frame after mount and
  // it never appeared at all.
  material.userData['evolutionBaseEmissiveIntensity'] = material.emissiveIntensity;
  applyEvolutionShader(material, source.shader);
  return material;
}
