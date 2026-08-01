extends RefCounted

## Renderer-independent data model for the Godot Evolution Engine.
## Nested classes keep the bootstrap compact while preserving explicit boundaries.

class ArtifactDNA:
	extends RefCounted

	var seed: int
	var species: StringName
	var engine_version: String
	var traits: Dictionary

	func _init(
		p_seed: int,
		p_species: StringName = &"crystal",
		p_engine_version: String = "godot-0.1.0",
		p_traits: Dictionary = {},
	) -> void:
		seed = p_seed
		species = p_species
		engine_version = p_engine_version
		traits = p_traits.duplicate(true)

	func to_dictionary() -> Dictionary:
		return {
			"seed": seed,
			"species": String(species),
			"engine_version": engine_version,
			"traits": traits.duplicate(true),
		}


class EvolutionEvent:
	extends RefCounted

	var id: String
	var occurred_at: String
	var source: String
	var evidence: String
	var channels: Dictionary
	var portal_activity: float

	func _init(
		p_id: String,
		p_occurred_at: String,
		p_source: String,
		p_evidence: String = "verified",
		p_channels: Dictionary = {},
		p_portal_activity: float = 0.0,
	) -> void:
		id = p_id
		occurred_at = p_occurred_at
		source = p_source
		evidence = p_evidence
		channels = p_channels.duplicate(true)
		portal_activity = clampf(p_portal_activity, 0.0, 1.0)

	static func from_dictionary(data: Dictionary) -> EvolutionEvent:
		return EvolutionEvent.new(
			String(data.get("id", "event:unknown")),
			String(data.get("occurred_at", "1970-01-01")),
			String(data.get("source", "unknown@1")),
			String(data.get("evidence", "verified")),
			Dictionary(data.get("channels", {})),
			float(data.get("portal_activity", 0.0)),
		)

	func sort_key() -> String:
		return "%s|%s" % [occurred_at, id]

	func to_dictionary() -> Dictionary:
		return {
			"id": id,
			"occurred_at": occurred_at,
			"source": source,
			"evidence": evidence,
			"channels": channels.duplicate(true),
			"portal_activity": portal_activity,
		}


class GrowthInstruction:
	extends RefCounted

	var id: String
	var parent_id: String
	var generation: int
	var attach_position: Vector3
	var direction: Vector3
	var radius: float
	var length: float
	var sides: int
	var energy: float
	var event_id: String
	var metadata: Dictionary

	func _init(
		p_id: String,
		p_parent_id: String,
		p_generation: int,
		p_attach_position: Vector3,
		p_direction: Vector3,
		p_radius: float,
		p_length: float,
		p_sides: int,
		p_energy: float,
		p_event_id: String = "",
		p_metadata: Dictionary = {},
	) -> void:
		id = p_id
		parent_id = p_parent_id
		generation = maxi(0, p_generation)
		attach_position = p_attach_position
		direction = p_direction.normalized() if p_direction.length_squared() > 0.000001 else Vector3.UP
		radius = maxf(0.01, p_radius)
		length = maxf(0.05, p_length)
		sides = clampi(p_sides, 5, 12)
		energy = clampf(p_energy, 0.0, 1.0)
		event_id = p_event_id
		metadata = p_metadata.duplicate(true)

	func endpoint() -> Vector3:
		return attach_position + direction * length

	func sample_point(t: float) -> Vector3:
		return attach_position.lerp(endpoint(), clampf(t, 0.0, 1.0))

	func to_dictionary() -> Dictionary:
		return {
			"id": id,
			"parent_id": parent_id,
			"generation": generation,
			"attach_position": [attach_position.x, attach_position.y, attach_position.z],
			"direction": [direction.x, direction.y, direction.z],
			"radius": radius,
			"length": length,
			"sides": sides,
			"energy": energy,
			"event_id": event_id,
			"metadata": metadata.duplicate(true),
		}


class EvolutionState:
	extends RefCounted

	var dna: ArtifactDNA
	var instructions: Array = []
	var history: Array = []
	var instruction_by_id: Dictionary = {}

	func _init(p_dna: ArtifactDNA) -> void:
		dna = p_dna

	func append_instruction(instruction: GrowthInstruction, event: EvolutionEvent = null) -> bool:
		if instruction_by_id.has(instruction.id):
			return false

		instructions.append(instruction)
		instruction_by_id[instruction.id] = instruction
		history.append({
			"instruction_id": instruction.id,
			"event": event.to_dictionary() if event != null else {"id": "genesis"},
		})
		return true

	func get_instruction(id: String) -> GrowthInstruction:
		return instruction_by_id.get(id) as GrowthInstruction

	func canonical_snapshot() -> Dictionary:
		var serialized_instructions: Array = []
		for instruction in instructions:
			serialized_instructions.append(instruction.to_dictionary())

		return {
			"dna": dna.to_dictionary(),
			"instructions": serialized_instructions,
			"history": history.duplicate(true),
		}
