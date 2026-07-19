#!/usr/bin/env python
# -*- coding: utf-8 -*-

import subprocess
import sys
import os

def check_nvidia_gpu():
    try:
        # Check if nvidia-smi works
        res = subprocess.run(["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return res.returncode == 0
    except Exception:
        return False

def cleanup_corrupted_downloads():
    print("Checking and cleaning up any corrupted Hugging Face download lock files...")
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    if os.path.exists(cache_dir):
        for root, dirs, files in os.walk(cache_dir):
            for file in files:
                if file.endswith(".lock") or "incomplete" in file:
                    try:
                        filepath = os.path.join(root, file)
                        print(f"Removing corrupted lock/temp file: {filepath}")
                        os.remove(filepath)
                    except Exception as e:
                        print(f"Error removing {file}: {e}")

def main():
    print("Starting automated setup for VieNeu-TTS...")
    cleanup_corrupted_downloads()
    
    # 1. Choose installation type and pre-install precompiled llama-cpp-python wheel
    py_ver = f"cp{sys.version_info.major}{sys.version_info.minor}"
    wheel_url = f"https://github.com/pnnbao97/VieNeu-TTS/releases/download/wheels-v0.3.16/llama_cpp_python-0.3.16-{py_ver}-{py_ver}-win_amd64.whl"
    
    print(f"Installing pre-built llama-cpp-python wheel for {py_ver} from GitHub Releases...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", wheel_url], check=True)
        print("Pre-built llama-cpp-python installed successfully!")
    except subprocess.CalledProcessError:
        print("Warning: Failed to install pre-built wheel. Proceeding with default pip installer...", file=sys.stderr)
        
    has_gpu = check_nvidia_gpu()
    installed = False
    
    if has_gpu:
        print("NVIDIA GPU detected. Attempting to install GPU-supported VieNeu-TTS...")
        try:
            print("Installing PyTorch, Torchaudio, and Torchvision with CUDA 12.4 support...")
            subprocess.run([sys.executable, "-m", "pip", "install", "torch==2.6.0+cu124", "torchaudio==2.6.0+cu124", "torchvision==0.21.0+cu124", "--index-url", "https://download.pytorch.org/whl/cu124"], check=True)
            
            subprocess.run([sys.executable, "-m", "pip", "install", "--prefer-binary", "vieneu[gpu]"], check=True)
            
            print("Forcing compatible torchao==0.12.0 version...")
            subprocess.run([sys.executable, "-m", "pip", "install", "torchao==0.12.0", "--no-cache-dir"], check=True)
            
            print("VieNeu-TTS [GPU] package installed successfully!")
            installed = True
        except subprocess.CalledProcessError as e:
            print(f"Warning: GPU installation failed ({str(e)}). Falling back to standard CPU version...", file=sys.stderr)
            
    if not installed:
        print("Installing standard VieNeu-TTS (CPU optimized)...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--prefer-binary", "vieneu"], check=True)
            print("VieNeu-TTS package installed successfully!")
        except subprocess.CalledProcessError as e:
            print(f"Failed to install package: {str(e)}", file=sys.stderr)
            sys.exit(1)
            
    # Install hf-transfer to accelerate model downloading by 5x-10x
    try:
        print("Installing hf-transfer for high-speed model downloading...")
        subprocess.run([sys.executable, "-m", "pip", "install", "hf-transfer"], check=True)
    except subprocess.CalledProcessError:
        print("Warning: Failed to install hf-transfer, downloading might be slower but will still work.", file=sys.stderr)
        
    # 2. Trigger Model Weights Download
    print("Triggering initial model weights download from Hugging Face...")
    
    # Enable Rust-based fast downloader and disable symlinks warning
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
    
    download_script = """
import os
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
from vieneu import Vieneu
try:
    print("Initializing Vieneu model weights download...")
    tts = Vieneu(onnx_subfolder="onnx_int8")
    print("SUCCESS: Model weights successfully cached.")
except Exception as e:
    print(f"Error during model initialization: {str(e)}")
    raise e
"""
    try:
        subprocess.run([sys.executable, "-c", download_script], check=True)
        print("Setup completed successfully!")
        sys.exit(0)
    except subprocess.CalledProcessError as e:
        print(f"Failed to download/cache model weights: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
