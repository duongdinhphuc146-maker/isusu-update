package services

import (
	"encoding/binary"
	"os"
)

// EncodePCMToWav writes mono float32 PCM samples to a standard 16-bit WAV file
func EncodePCMToWav(samples []float32, sampleRate int, outputPath string) error {
	f, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer f.Close()

	numSamples := len(samples)
	numChannels := 1
	bytesPerSample := 2 // converting to 16-bit PCM

	subChunk2Size := numSamples * numChannels * bytesPerSample
	chunkSize := 36 + subChunk2Size

	// Write RIFF Header
	_, _ = f.Write([]byte("RIFF"))
	_ = writeUint32(f, uint32(chunkSize))
	_, _ = f.Write([]byte("WAVE"))

	// Write fmt Subchunk
	_, _ = f.Write([]byte("fmt "))
	_ = writeUint32(f, 16) // Subchunk1Size
	_ = writeUint16(f, 1)  // AudioFormat (1 = PCM)
	_ = writeUint16(f, uint16(numChannels))
	_ = writeUint32(f, uint32(sampleRate))
	_ = writeUint32(f, uint32(sampleRate*numChannels*bytesPerSample)) // ByteRate
	_ = writeUint16(f, uint16(numChannels*bytesPerSample))            // BlockAlign
	_ = writeUint16(f, 16)                                            // BitsPerSample

	// Write data Subchunk
	_, _ = f.Write([]byte("data"))
	_ = writeUint32(f, uint32(subChunk2Size))

	// Write audio data converted to 16-bit signed PCM
	for _, sample := range samples {
		// Clamp float32 [-1.0, 1.0] to int16 range
		val := int16(sample * 32767.0)
		if sample > 1.0 {
			val = 32767
		} else if sample < -1.0 {
			val = -32768
		}
		_ = writeInt16(f, val)
	}

	return nil
}

func writeUint32(f *os.File, val uint32) error {
	buf := make([]byte, 4)
	binary.LittleEndian.PutUint32(buf, val)
	_, err := f.Write(buf)
	return err
}

func writeUint16(f *os.File, val uint16) error {
	buf := make([]byte, 2)
	binary.LittleEndian.PutUint16(buf, val)
	_, err := f.Write(buf)
	return err
}

func writeInt16(f *os.File, val int16) error {
	buf := make([]byte, 2)
	binary.LittleEndian.PutUint16(buf, uint16(val))
	_, err := f.Write(buf)
	return err
}
