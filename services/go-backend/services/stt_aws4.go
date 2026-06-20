package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

func Sha256Hex(data []byte) string {
	h := sha256.New()
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func HmacSha256(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func Aws4SigningKey(secretKey, dateStamp, region, service string) []byte {
	kDate := HmacSha256([]byte("AWS4"+secretKey), []byte(dateStamp))
	kRegion := HmacSha256(kDate, []byte(region))
	kService := HmacSha256(kRegion, []byte(service))
	return HmacSha256(kService, []byte("aws4_request"))
}

func CanonicalQuery(rawUrl string) string {
	u, err := url.Parse(rawUrl)
	if err != nil {
		return ""
	}
	q := u.Query()
	var keys []string
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		val := q.Get(k)
		pairs = append(pairs, url.QueryEscape(k)+"="+url.QueryEscape(val))
	}
	return strings.Join(pairs, "&")
}

func Aws4Authorization(method, rawUrl string, body []byte, accessKey, secretKey, token, amzDate, region, service string) string {
	dateStamp := amzDate[:8]
	scope := fmt.Sprintf("%s/%s/%s/aws4_request", dateStamp, region, service)
	signedHeaders := "x-amz-date;x-amz-security-token"
	canonicalHeaders := fmt.Sprintf("x-amz-date:%s\nx-amz-security-token:%s\n", amzDate, token)

	u, _ := url.Parse(rawUrl)
	canonicalRequest := strings.Join([]string{
		method,
		u.Path,
		CanonicalQuery(rawUrl),
		canonicalHeaders,
		signedHeaders,
		Sha256Hex(body),
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		Sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := Aws4SigningKey(secretKey, dateStamp, region, service)
	signature := hex.EncodeToString(HmacSha256(signingKey, []byte(stringToSign)))

	return fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		accessKey, scope, signedHeaders, signature)
}
