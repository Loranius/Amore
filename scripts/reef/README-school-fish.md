# Reef fish materializer

`materializer.tgz.b64` is a checksum-pinned build bundle used only to transform the exact licensed `School Of Fish` source export into the mobile web asset served by Amore.

Source model: School Of Fish by Titanas YT (@pcarnage252)
Sketchfab model id: 25494f5c4ead471ab8205aadfbfec0bc
License: CC BY 4.0
Pinned source mirror commit: e8af97a4d3d81047b7132a957a23f66f4d1bc4d0

The bundle contains four small Python tools: external glTF packing, exact duplicate-vertex removal + error-bounded animation key reduction + PBR conversion, texture repacking, and structural validation. `materialize_school_fish.sh` verifies both bundle checksums before executing it.

The generated output must preserve 4 authored mesh groups, 166 nodes, 148 joints, one `swimming` animation with 228 channels, approximately 40.97 seconds duration, and remain under 2 MB.

The materializer preserves the authored scene transform. `ReefFishSchool.tsx` owns the final reef-world position and scale so binary optimization cannot silently move the school out of the mobile camera.
