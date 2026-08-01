extends Node

signal payload_received(payload_json: String)
signal lifecycle_received(event: Dictionary)

const POLL_INTERVAL_SECONDS := 0.2

var _active := false
var _elapsed := 0.0
var _capabilities: Dictionary = {}


func _ready() -> void:
	_active = OS.has_feature("web")
	set_process(_active)
	if _active:
		_capabilities = _read_capabilities()
		post_message({
			"type": "amore:godot:ready",
			"version": "4.7.1",
			"runtime": "godot",
		})


func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed < POLL_INTERVAL_SECONDS:
		return
	_elapsed = 0.0

	var queued_payload = JavaScriptBridge.eval(
		"window.AmoreGodotBridge ? window.AmoreGodotBridge.takePayload() : ''",
		true,
	)
	if typeof(queued_payload) == TYPE_STRING and not String(queued_payload).is_empty():
		payload_received.emit(String(queued_payload))

	var queued_lifecycle = JavaScriptBridge.eval(
		"window.AmoreGodotBridge ? window.AmoreGodotBridge.takeLifecycle() : ''",
		true,
	)
	if typeof(queued_lifecycle) == TYPE_STRING and not String(queued_lifecycle).is_empty():
		var parsed = JSON.parse_string(String(queued_lifecycle))
		if typeof(parsed) == TYPE_DICTIONARY:
			lifecycle_received.emit(Dictionary(parsed))


func runtime_capabilities() -> Dictionary:
	if _active:
		_capabilities = _read_capabilities()
	return _capabilities.duplicate(true)


func prefers_reduced_motion() -> bool:
	if not _active:
		return false
	return bool(runtime_capabilities().get("reduced_motion", false))


func post_message(message: Dictionary) -> void:
	if not _active:
		return

	var encoded := Marshalls.utf8_to_base64(JSON.stringify(message))
	JavaScriptBridge.eval(
		"window.AmoreGodotBridge && window.AmoreGodotBridge.postBase64('%s')" % encoded,
		true,
	)


func _read_capabilities() -> Dictionary:
	var capabilities_json = JavaScriptBridge.eval(
		"window.AmoreGodotBridge ? window.AmoreGodotBridge.capabilitiesJson() : '{}'",
		true,
	)
	if typeof(capabilities_json) != TYPE_STRING:
		return {}
	var parsed = JSON.parse_string(String(capabilities_json))
	return Dictionary(parsed) if typeof(parsed) == TYPE_DICTIONARY else {}
