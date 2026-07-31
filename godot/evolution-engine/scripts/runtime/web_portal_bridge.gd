extends Node

signal payload_received(payload_json: String)

const POLL_INTERVAL_SECONDS := 0.2

var _active := false
var _elapsed := 0.0


func _ready() -> void:
	_active = OS.has_feature("web")
	set_process(_active)
	if _active:
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


func post_message(message: Dictionary) -> void:
	if not _active:
		return

	var encoded := Marshalls.utf8_to_base64(JSON.stringify(message))
	JavaScriptBridge.eval(
		"window.AmoreGodotBridge && window.AmoreGodotBridge.postBase64('%s')" % encoded,
		true,
	)
