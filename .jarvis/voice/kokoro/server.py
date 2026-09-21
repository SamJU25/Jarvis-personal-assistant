import io
import os
import soundfile as sf
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from kokoro_onnx import Kokoro

app = FastAPI(title="Kokoro TTS Local Service")

current_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.normpath(os.path.join(current_dir, "../models/kokoro/kokoro-v0_19.onnx"))

def get_voices_path():
    for name in ["voices-v1.0.bin", "voices.bin", "voices.json"]:
        p = os.path.normpath(os.path.join(current_dir, f"../models/kokoro/{name}"))
        if os.path.exists(p):
            return p
    return os.path.normpath(os.path.join(current_dir, "../models/kokoro/voices-v1.0.bin"))

VOICES_PATH = get_voices_path()

_kokoro_instance = None

def get_kokoro():
    global _kokoro_instance, VOICES_PATH
    if _kokoro_instance is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(f"Kokoro model not found at {MODEL_PATH}")
        VOICES_PATH = get_voices_path()
        if not os.path.exists(VOICES_PATH):
            raise RuntimeError(f"Kokoro voices file not found at {VOICES_PATH}")
        _kokoro_instance = Kokoro(MODEL_PATH, VOICES_PATH)
    return _kokoro_instance

@app.get("/")
def root():
    return {"status": "ok", "service": "kokoro-tts", "version": "0.19"}

@app.get("/health")
def health():
    ready = os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH)
    return {"status": "ok" if ready else "pending_model", "ready": ready}

@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "kokoro",
                "object": "model",
                "created": 1700000000,
                "owned_by": "hexgrad"
            }
        ]
    }

@app.get("/v1/audio/voices")
def list_voices():
    try:
        engine = get_kokoro()
        voices = engine.get_voices()
        return {"voices": voices}
    except Exception:
        return {"voices": ["af_heart"], "default": "af_heart"}

class SpeechRequest(BaseModel):
    model: str = "kokoro"
    input: str
    voice: str = "af_heart"
    speed: float = 1.0
    response_format: str = "wav"

@app.post("/v1/audio/speech")
async def generate_speech(req: SpeechRequest):
    text = req.input.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Input text cannot be empty")
    
    try:
        engine = get_kokoro()
        # Create audio samples using requested voice and speed
        samples, sample_rate = engine.create(
            text,
            voice=req.voice or "af_heart",
            speed=float(req.speed) if req.speed else 1.0,
            lang="en-us"
        )
        
        buffer = io.BytesIO()
        sf.write(buffer, samples, sample_rate, format="WAV")
        buffer.seek(0)
        
        return Response(
            content=buffer.read(),
            media_type="audio/wav",
            headers={
                "Content-Type": "audio/wav",
                "Cache-Control": "no-store"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8880)
