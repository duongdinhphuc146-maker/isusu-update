#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import sys
import os

def main():
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
    parser = argparse.ArgumentParser(description="VieNeu-TTS CLI Inference Wrapper")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--voice", default="Trúc Ly", help="Voice name")
    parser.add_argument("--mode", default="remote", choices=["local", "remote"], help="Local SDK or Remote API mode")
    parser.add_argument("--api-base", default="http://localhost:23333/v1", help="API base URL for remote mode")
    parser.add_argument("--clone-audio", default="", help="Path to reference audio file for voice cloning")
    parser.add_argument("--style", default="tu_nhien", choices=["tu_nhien", "tin_tuc", "doc_truyen"], help="Reading style")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"], help="Execution device (auto, cpu, cuda)")
    parser.add_argument("--output", required=True, help="Output path for the generated wav file")
    
    args = parser.parse_args()
    
    try:
        from vieneu import Vieneu
    except ImportError:
        print("Error: The 'vieneu' package is not installed. Please install it with 'pip install vieneu'", file=sys.stderr)
        sys.exit(1)
        
    try:
        # Initialize Vieneu
        if args.mode == "remote":
            print(f"Initializing VieNeu-TTS in Remote mode with API base: {args.api_base}")
            tts = Vieneu(mode="remote", api_base=args.api_base)
        else:
            # Determine backend details
            try:
                import torch
                has_cuda = torch.cuda.is_available()
            except ImportError:
                has_cuda = False
            
            backend_info = "PyTorch (GPU)" if (args.device == "cuda" or (args.device == "auto" and has_cuda)) else "ONNX (CPU)"
            subfolder_info = "update (FP16/BF16)" if backend_info == "PyTorch (GPU)" else "onnx_int8 (INT8 Quantized)"
            print(f"Initializing VieNeu-TTS in Local mode: Device={args.device}, Backend={backend_info}, Subfolder={subfolder_info}")
            
            tts = Vieneu(device=args.device, onnx_subfolder="onnx_int8")
            
        # Inference parameters
        kwargs = {}
        if args.clone_audio and os.path.exists(args.clone_audio):
            kwargs["ref_audio"] = args.clone_audio
            kwargs["denoise"] = True
        else:
            kwargs["voice"] = args.voice
            
        audio = tts.infer(text=args.text, style=args.style, **kwargs)
        
        # Save output
        tts.save(audio, args.output)
        print(f"Success: Audio saved to {args.output}")
        sys.exit(0)
    except Exception as e:
        print(f"Error during TTS inference: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
