extends SceneTree

const Model = preload("res://scripts/core/evolution_model.gd")
const GrowthEngine = preload("res://scripts/growth/growth_engine.gd")
const CrystalMeshBuilder = preload("res://scripts/geometry/crystal_mesh_builder.gd")
const CrystalColonyProjection = preload("res://scripts/geometry/crystal_colony_projection.gd")


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var dna := Model.ArtifactDNA.new(
		582013,
		&"crystal",
		"godot-0.1.0",
		{"identity": "integrated-fusion-smoke"},
	)
	var events: Array = [
		Model.EvolutionEvent.from_dictionary({
			"id": "event:first",
			"occurred_at": "2025-01-01",
			"source": "memories@1",
			"channels": {"remembrance": 0.86, "significance": 0.72},
			"portal_activity": 0.34,
		}),
		Model.EvolutionEvent.from_dictionary({
			"id": "event:second",
			"occurred_at": "2025-02-01",
			"source": "plans@1",
			"channels": {"achievement": 0.84, "stability": 0.58},
			"portal_activity": 0.38,
		}),
	]
	var state = GrowthEngine.new().rebuild(dna, events)
	var projected: Array = CrystalColonyProjection.new().build(state)
	var builder = CrystalMeshBuilder.new()
	var attached_count := 0

	for instruction in projected:
		if instruction.generation <= 0:
			continue
		attached_count += 1
		var mesh: ArrayMesh = builder.create_mesh(instruction)
		if mesh == null or mesh.get_surface_count() != 1:
			_fail("Integrated fusion failure: attached Crystal must use one mesh surface.")
			return

		var arrays: Array = mesh.surface_get_arrays(0)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		if vertices.is_empty():
			_fail("Integrated fusion failure: attached Crystal vertex buffer is empty.")
			return

		var minimum_y := 1.0e20
		for vertex in vertices:
			minimum_y = minf(minimum_y, vertex.y)
		if minimum_y > -instruction.radius * 0.2:
			_fail("Integrated fusion failure: root is not buried below the attachment plane.")
			return

		var root_radius := 0.0
		var flare_radius := 0.0
		var body_radius := 0.0
		var flare_band: float = maxf(instruction.length * 0.022, instruction.radius * 0.065)
		var body_y: float = instruction.length * 0.145
		var body_band: float = maxf(instruction.length * 0.018, instruction.radius * 0.04)
		for vertex in vertices:
			var radial_radius: float = Vector2(vertex.x, vertex.z).length()
			if absf(vertex.y - minimum_y) < 0.0001:
				root_radius = maxf(root_radius, radial_radius)
			if absf(vertex.y) <= flare_band:
				flare_radius = maxf(flare_radius, radial_radius)
			if absf(vertex.y - body_y) <= body_band:
				body_radius = maxf(body_radius, radial_radius)

		if root_radius <= 0.0 or flare_radius <= 0.0 or body_radius <= 0.0:
			_fail("Integrated fusion failure: root, flare or body ring was not found.")
			return
		if flare_radius < root_radius * 1.32:
			_fail(
				"Integrated fusion failure: flare %.4f does not cover root %.4f."
				% [flare_radius, root_radius],
			)
			return
		if flare_radius > body_radius * 1.3:
			_fail(
				"Integrated fusion failure: flare %.4f reads as a bracelet over body %.4f."
				% [flare_radius, body_radius],
			)
			return
		# The lower ring has a nominal 1.035R radius. Accepted morphology and
		# bounded colony projection remain inside the same local continuity band.
		if body_radius < instruction.radius * 0.93 or body_radius > instruction.radius * 1.18:
			_fail(
				"Integrated fusion failure: body %.4f is outside 0.93–1.18 × R %.4f."
				% [body_radius, instruction.radius],
			)
			return

		var material := mesh.surface_get_material(0) as StandardMaterial3D
		if material == null:
			_fail("Integrated fusion failure: attached Crystal material is missing.")
			return

	if attached_count == 0:
		_fail("Integrated fusion failure: no attached Crystal instructions were generated.")
		return

	print("PASS: integrated crystal fusion; attached=%d" % attached_count)
	quit(0)


func _fail(message: String) -> void:
	push_error(message)
	quit(1)
