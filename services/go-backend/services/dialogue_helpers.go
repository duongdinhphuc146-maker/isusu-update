package services

import (
	"strings"
)

// IsMaleGender determines if a string describes a male speaker
func IsMaleGender(gender string) bool {
	g := strings.ToLower(strings.TrimSpace(gender))
	return strings.Contains(g, "male") || strings.Contains(g, "nam") || strings.Contains(g, "man") || strings.Contains(g, "boy")
}

// IsFemaleGender determines if a string describes a female speaker
func IsFemaleGender(gender string) bool {
	g := strings.ToLower(strings.TrimSpace(gender))
	return strings.Contains(g, "female") || strings.Contains(g, "nữ") || strings.Contains(g, "woman") || strings.Contains(g, "girl") || strings.Contains(g, "nu")
}

// GetDefaultVoiceForLanguage returns the default voice type and resource ID based on language and gender
func GetDefaultVoiceForLanguage(targetLang string, gender string) (string, string) {
	lang := strings.ToLower(targetLang)
	if strings.Contains(lang, "-") {
		lang = strings.Split(lang, "-")[0]
	}
	if strings.Contains(lang, "_") {
		lang = strings.Split(lang, "_")[0]
	}

	// Normalize targetLang names
	if strings.Contains(lang, "viet") || lang == "vi" {
		lang = "vi"
	} else if strings.Contains(lang, "eng") || lang == "en" {
		lang = "en"
	} else if strings.Contains(lang, "chin") || strings.Contains(lang, "zh") {
		lang = "zh"
	} else if strings.Contains(lang, "jap") || lang == "ja" {
		lang = "ja"
	} else if strings.Contains(lang, "thai") || lang == "th" {
		lang = "th"
	}

	isMale := IsMaleGender(gender)

	switch lang {
	case "vi":
		if isMale {
			return "multi_male_felipe_uranus_bigtts", "7637456729696996628"
		}
		return "BV074_streaming", "7102355709945188865"
	case "en":
		if isMale {
			return "en_us_010", "7114563482359435778"
		}
		return "en_female_emotional_moon_bigtts", "7114563483257016833"
	case "ja":
		if isMale {
			return "ICL_ja_male_xinggan", "7522965008020540688"
		}
		return "ICL_ja_female_zhiyu", "7579078759446285584"
	case "zh":
		if isMale {
			return "zh_male_tangsengdsp", "7520150587619478801"
		}
		return "zh_female_xiaonan_lv_clone2", "7554226531451833617"
	case "th":
		if isMale {
			return "th", "7371666742055014913"
		}
		return "BV421_thth_streaming_vibrato_dsp", "7569439521352338689"
	default:
		if isMale {
			return "en_us_010", "7114563482359435778"
		}
		return "en_female_emotional_moon_bigtts", "7114563483257016833"
	}
}
