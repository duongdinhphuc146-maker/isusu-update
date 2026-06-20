package services

import (
	"fmt"
	"hash/crc32"
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
