package services

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func SaveCharacterMap(cmap *CharacterMap, projectDir string) error {
	_ = os.MkdirAll(projectDir, 0755)
	filePath := filepath.Join(projectDir, "character_map.json")
	data, err := json.MarshalIndent(cmap, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

func LoadCharacterMap(projectDir string) (*CharacterMap, error) {
	filePath := filepath.Join(projectDir, "character_map.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var cmap CharacterMap
	if err := json.Unmarshal(data, &cmap); err != nil {
		return nil, err
	}
	return &cmap, nil
}
