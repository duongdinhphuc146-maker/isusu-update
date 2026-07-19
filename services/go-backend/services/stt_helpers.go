package services

import (
	"fmt"
	"hash/crc32"
	"strconv"
	"strings"
	"time"
)

func base_headers_raw(device DeviceInfo, bodyText string) map[string]string {
	now := fmt.Sprintf("%d", time.Now().Unix())
	return map[string]string{
		"content-type":    "application/json",
		"appvr":           device.Appvr,
		"ch":              device.Channel,
		"device-time":     now,
		"lan":             device.Lan,
		"loc":             device.Loc,
		"pf":              device.Pf,
		"sign-ver":        "1",
		"tdid":            device.Tdid,
		"x-ss-stub":       Md5Hex(bodyText),
		"x-ss-dp":         device.Aid,
		"x-khronos":       now,
		"x-tt-trace-id":   "00-" + Md5Hex(now)[:16] + "-" + Md5Hex(now)[16:] + "-01",
		"user-agent":      device.UserAgent,
	}
}

func Crc32Hex(data []byte) string {
	return fmt.Sprintf("%08x", crc32.ChecksumIEEE(data))
}

func VodSignedHeaders(method, reqUrl string, body []byte, creds UploadCredentials, device DeviceInfo, amzDate, httpDate string) map[string]string {
	return map[string]string{
		"Authorization":          Aws4Authorization(method, reqUrl, body, creds.AccessKeyID, creds.SecretAccessKey, creds.SessionToken, amzDate, "sdwdmwlll", "vod"),
		"Date":                   httpDate,
		"User-Agent":             fmt.Sprintf("BDFileUpload(%d)", time.Now().UnixNano()/1e6),
		"X-Amz-Date":             amzDate,
		"X-Amz-Expires":          "31536000",
		"X-Amz-Security-Token":   creds.SessionToken,
		"accept-encoding":        "identity",
		"store-country-code":     strings.ToLower(device.Loc),
		"store-country-code-src": "did",
		"is-dispatch-us-ttp":     "0",
		"is-app-region-us-ttp":   "0",
		"tdid":                   device.Tdid,
		"pf":                     device.Pf,
	}
}

// OffsetSRT parses SRT, offsets all timestamps, and adjusts subtitle index counters.
func OffsetSRT(srt string, offsetMs int, startIndex int) (string, int) {
	lines := strings.Split(strings.ReplaceAll(srt, "\r\n", "\n"), "\n")
	var result []string
	indexCounter := startIndex
	expectTime := false

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			if len(result) > 0 && result[len(result)-1] != "" {
				result = append(result, "")
			}
			continue
		}

		// Check if it's the index line
		if _, err := strconv.Atoi(line); err == nil && !expectTime {
			result = append(result, strconv.Itoa(indexCounter))
			indexCounter++
			expectTime = true
			continue
		}

		if strings.Contains(line, "-->") {
			parts := strings.Split(line, "-->")
			if len(parts) == 2 {
				start := shiftSRTTime(strings.TrimSpace(parts[0]), offsetMs)
				end := shiftSRTTime(strings.TrimSpace(parts[1]), offsetMs)
				result = append(result, fmt.Sprintf("%s --> %s", start, end))
			} else {
				result = append(result, line)
			}
			expectTime = false
			continue
		}

		result = append(result, line)
		expectTime = false
	}

	return strings.Join(result, "\n"), indexCounter
}

func shiftSRTTime(t string, offsetMs int) string {
	var h, m, s, ms int
	_, err := fmt.Sscanf(t, "%d:%d:%d,%d", &h, &m, &s, &ms)
	if err != nil {
		return t
	}
	totalMs := h*3600000 + m*60000 + s*1000 + ms + offsetMs
	if totalMs < 0 {
		totalMs = 0
	}
	nh := totalMs / 3600000
	totalMs %= 3600000
	nm := totalMs / 60000
	totalMs %= 60000
	ns := totalMs / 1000
	nms := totalMs % 1000
	return fmt.Sprintf("%02d:%02d:%02d,%03d", nh, nm, ns, nms)
}
