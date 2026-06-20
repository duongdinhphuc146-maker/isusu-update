package services

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"strings"
)

const (
	BASE                    = "https://editor-api-sg.capcutapi.com"
	TTS_SIGN_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmTd34Lw4b7IuldSXh/zY
CMla+ITdGG5TeWz6ad+OySd4r+IrY45AoqrYUxhQ2dl+7z+i7r/5vEa8rr39BYfB
8AGMQLmZA8HmgpWBsqrn/V6daUALkKnkLb70Fn32CJigIuGXAYqxUdGuI340aC+0
v5Es3puJsHyzf01/AelE4Cdc6bZhQrASJLBh8R3BQToYClmDVSDUQk28o8sl/guA
Z4n303Vj+6Siv1HayPCdV6kpVVnMBAG4+umUbwGmn132N3fgpzLarFF3XyWmS1zh
D/J07iM/rP8GDO9IskHNHd2phrO0G6KzrcFAnTBHjVv+hCBEfzN/no3FNA9AuC36
mwIDAQAB
-----END PUBLIC KEY-----`
)

type DeviceInfo struct {
	Aid            string `json:"aid"`
	AppName        string `json:"app_name"`
	Appvr          string `json:"appvr"`
	VersionName    string `json:"version_name"`
	VersionCode    string `json:"version_code"`
	Channel        string `json:"channel"`
	DevicePlatform string `json:"device_platform"`
	DeviceType     string `json:"device_type"`
	DeviceBrand    string `json:"device_brand"`
	OsVersion      string `json:"os_version"`
	DeviceID       string `json:"device_id"`
	Iid            string `json:"iid"`
	Region         string `json:"region"`
	Loc            string `json:"loc"`
	Lan            string `json:"lan"`
	Pf             string `json:"pf"`
	Tdid           string `json:"tdid"`
	UserAgent      string `json:"user_agent"`
}

var userAgents = []string{
	"Cronet/TTNetVersion:1d7cc3b1 2025-07-16 QuicVersion:52c2b40d 2025-04-03",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
}

func RandomDeviceID() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(9000000000000000000))
	return n.Add(n, big.NewInt(1000000000000000000)).String()
}

func GetDynamicDevice() DeviceInfo {
	id := RandomDeviceID()
	iid := RandomDeviceID()
	tdid := RandomDeviceID()
	uaIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(userAgents))))
	ua := userAgents[uaIdx.Int64()]

	return DeviceInfo{
		Aid:            "359289",
		AppName:        "CapCut",
		Appvr:          "8.7.0",
		VersionName:    "8.7.0",
		VersionCode:    "8.7.0",
		Channel:        "capcutpc_google",
		DevicePlatform: "mac",
		DeviceType:     "MacBookPro17,1",
		DeviceBrand:    "MacBookPro17,1",
		OsVersion:      "15.7.4",
		DeviceID:       id,
		Iid:            iid,
		Region:         "VN",
		Loc:            "VN",
		Lan:            "vi-VN",
		Pf:             "3",
		Tdid:           tdid,
		UserAgent:      ua,
	}
}

func Md5Hex(data string) string {
	h := md5.New()
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func RsaEncryptPKCS1v15(message string) (string, error) {
	block, _ := pem.Decode([]byte(TTS_SIGN_PUBLIC_KEY_PEM))
	if block == nil {
		return "", fmt.Errorf("failed to parse PEM public key")
	}
	pubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return "", err
	}
	rsaPubKey, ok := pubKey.(*rsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("not an RSA public key")
	}
	encrypted, err := rsa.EncryptPKCS1v15(rand.Reader, rsaPubKey, []byte(message))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func MakeTtsPayloadSign(ssml, extraInfo, deviceID, appID string) (string, error) {
	ssmlMd5 := Md5Hex(ssml)
	signInput := fmt.Sprintf("appid:%s&did:%s&creditDisable:false&ssml:%s", appID, deviceID, ssmlMd5)
	if extraInfo != "" {
		signInput += fmt.Sprintf("&extraInfo:%s", extraInfo)
	}
	return RsaEncryptPKCS1v15(signInput)
}

func MakeSignHeader(reqUrl, appvr, deviceTime, tdid string) string {
	u, _ := urlParse(reqUrl)
	path := u.Path
	var lastSeven string
	if len(path) > 7 {
		lastSeven = path[len(path)-7:]
	} else {
		lastSeven = path
	}
	signStr := fmt.Sprintf("9e2c|%s|3|%s|%s|%s|11ac", lastSeven, appvr, deviceTime, tdid)
	return Md5Hex(signStr)
}

func urlParse(raw string) (*urlParts, error) {
	// Simple path/query extractor to avoid extra imports if parsing is simple
	idx := strings.Index(raw, "?")
	var path string
	if idx == -1 {
		path = raw
	} else {
		path = raw[:idx]
	}
	// Extract resource path
	pIdx := strings.Index(path, "://")
	if pIdx != -1 {
		path = path[pIdx+3:]
		sIdx := strings.Index(path, "/")
		if sIdx != -1 {
			path = path[sIdx:]
		} else {
			path = "/"
		}
	}
	return &urlParts{Path: path}, nil
}

type urlParts struct {
	Path string
}

func EscapeXML(text string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		`'`, "&apos;",
	)
	return r.Replace(text)
}
