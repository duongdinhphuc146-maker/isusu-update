package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type UploadAddress struct {
	UploadHost string
	StoreUri   string
	UploadID   string
	Auth       string
	SessionKey string
}

func ApplyUploadInner(client *http.Client, creds UploadCredentials, device DeviceInfo) (*UploadAddress, error) {
	applyUrl := fmt.Sprintf("https://%s/top/v1?Action=ApplyUploadInner&SpaceName=%s&UseQuic=false&Version=2020-11-19&device_platform=win",
		creds.Domain, creds.SpaceName)

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	httpDate := now.Format("Mon, 02 Jan 2006 15:04:05 GMT")

	reqApply, _ := http.NewRequest("GET", applyUrl, nil)
	applyHeaders := VodSignedHeaders("GET", applyUrl, nil, creds, device, amzDate, httpDate)
	for k, v := range applyHeaders {
		reqApply.Header.Set(k, v)
	}

	respApply, err := client.Do(reqApply)
	if err != nil {
		return nil, err
	}
	defer respApply.Body.Close()

	if respApply.StatusCode >= 400 {
		bodyB, _ := io.ReadAll(respApply.Body)
		return nil, fmt.Errorf("ApplyUploadInner HTTP status %d: %s", respApply.StatusCode, string(bodyB))
	}

	var applyData map[string]interface{}
	if err := json.NewDecoder(respApply.Body).Decode(&applyData); err != nil {
		return nil, fmt.Errorf("failed to decode ApplyUploadInner response: %w", err)
	}

	resultObj, ok := applyData["Result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("missing Result in ApplyUploadInner response: %v", applyData)
	}
	innerObj, ok := resultObj["InnerUploadAddress"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("missing InnerUploadAddress in ApplyUploadInner response: %v", applyData)
	}
	nodes, ok := innerObj["UploadNodes"].([]interface{})
	if !ok || len(nodes) == 0 {
		return nil, fmt.Errorf("missing UploadNodes in ApplyUploadInner response: %v", applyData)
	}
	node, ok := nodes[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid UploadNode format: %v", nodes[0])
	}
	storeInfos, ok := node["StoreInfos"].([]interface{})
	if !ok || len(storeInfos) == 0 {
		return nil, fmt.Errorf("missing StoreInfos in ApplyUploadInner response: %v", applyData)
	}
	store, ok := storeInfos[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid StoreInfo format: %v", storeInfos[0])
	}

	return &UploadAddress{
		UploadHost: node["UploadHost"].(string),
		StoreUri:   store["StoreUri"].(string),
		UploadID:   store["UploadID"].(string),
		Auth:       store["Auth"].(string),
		SessionKey: node["SessionKey"].(string),
	}, nil
}

func TransferAndFinishAudio(client *http.Client, audioBytes []byte, addr *UploadAddress, httpDate string) error {
	crc32Str := Crc32Hex(audioBytes)
	transferUrl := fmt.Sprintf("https://%s/upload/v1/%s?uploadid=%s&part_number=0&phase=transfer",
		addr.UploadHost, addr.StoreUri, addr.UploadID)

	reqTrans, _ := http.NewRequest("POST", transferUrl, bytes.NewReader(audioBytes))
	reqTrans.Header.Set("Authorization", addr.Auth)
	reqTrans.Header.Set("Date", httpDate)
	reqTrans.Header.Set("Content-Type", "application/octet-stream")
	reqTrans.Header.Set("X-Upload-Content-CRC32", crc32Str)
	reqTrans.Header.Set("User-Agent", fmt.Sprintf("BDFileUpload(%d)", time.Now().UnixNano()/1e6))
	reqTrans.Header.Set("accept-encoding", "identity")

	respTrans, err := client.Do(reqTrans)
	if err != nil {
		return err
	}
	defer respTrans.Body.Close()

	if respTrans.StatusCode >= 400 {
		bodyB, _ := io.ReadAll(respTrans.Body)
		return fmt.Errorf("Binary Transfer HTTP status %d: %s", respTrans.StatusCode, string(bodyB))
	}

	finishUrl := fmt.Sprintf("https://%s/upload/v1/%s?uploadmode=part&phase=finish&uploadid=%s",
		addr.UploadHost, addr.StoreUri, addr.UploadID)
	finishBody := fmt.Sprintf("0:%s", crc32Str)

	reqFinish, _ := http.NewRequest("POST", finishUrl, bytes.NewReader([]byte(finishBody)))
	reqFinish.Header.Set("Authorization", addr.Auth)
	reqFinish.Header.Set("Date", httpDate)
	reqFinish.Header.Set("User-Agent", fmt.Sprintf("BDFileUpload(%d)", time.Now().UnixNano()/1e6))
	reqFinish.Header.Set("accept-encoding", "identity")

	respFinish, err := client.Do(reqFinish)
	if err != nil {
		return err
	}
	defer respFinish.Body.Close()

	if respFinish.StatusCode >= 400 {
		bodyB, _ := io.ReadAll(respFinish.Body)
		return fmt.Errorf("Finish upload HTTP status %d: %s", respFinish.StatusCode, string(bodyB))
	}

	return nil
}

func CommitUploadInner(client *http.Client, creds UploadCredentials, device DeviceInfo, sessionKey, amzDate, httpDate string, audioBytes []byte) (*CommitResult, error) {
	commitUrl := fmt.Sprintf("https://%s/top/v1?Action=CommitUploadInner&SpaceName=%s&Version=2020-11-19&device_platform=win",
		creds.Domain, creds.SpaceName)

	commitBody := fmt.Sprintf(`{"Functions":[{"Input":{"SnapshotTime":0},"Name":"Snapshot"}],"SessionKey":"%s"}`, sessionKey)
	reqCommit, _ := http.NewRequest("POST", commitUrl, bytes.NewReader([]byte(commitBody)))
	commitHeaders := VodSignedHeaders("POST", commitUrl, []byte(commitBody), creds, device, amzDate, httpDate)
	for k, v := range commitHeaders {
		reqCommit.Header.Set(k, v)
	}

	respCommit, err := client.Do(reqCommit)
	if err != nil {
		return nil, err
	}
	defer respCommit.Body.Close()

	if respCommit.StatusCode >= 400 {
		bodyB, _ := io.ReadAll(respCommit.Body)
		return nil, fmt.Errorf("CommitUploadInner HTTP status %d: %s", respCommit.StatusCode, string(bodyB))
	}

	var commitData map[string]interface{}
	if err := json.NewDecoder(respCommit.Body).Decode(&commitData); err != nil {
		return nil, fmt.Errorf("failed to decode CommitUploadInner response: %w", err)
	}

	commitResult, ok := commitData["Result"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("missing Result in CommitUploadInner response: %v", commitData)
	}
	resultsList, ok := commitResult["Results"].([]interface{})
	if !ok || len(resultsList) == 0 {
		return nil, fmt.Errorf("missing Results in CommitUploadInner response: %v", commitData)
	}
	resultItem, ok := resultsList[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid result item: %v", resultsList[0])
	}

	vid, _ := resultItem["Vid"].(string)
	meta, _ := resultItem["VideoMeta"].(map[string]interface{})
	durationSec, _ := meta["Duration"].(float64)

	localMd5 := Md5Hex(string(audioBytes))

	return &CommitResult{
		Vid:        vid,
		Md5:        localMd5,
		DurationMs: int(durationSec * 1000),
	}, nil
}

