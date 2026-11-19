package app

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var hex16Re = regexp.MustCompile(`^[0-9a-f]{16}$`)

type DiscoveredModel struct {
	HexID string `json:"hex_id"`
	Name  string `json:"name"`
	Desc  string `json:"desc"`
	Mode  int    `json:"mode"`
}

func findModelsInArray(v any, out *[]DiscoveredModel, seen map[string]bool) {
	switch val := v.(type) {
	case []any:
		if len(val) >= 3 {
			if h, ok := val[0].(string); ok && hex16Re.MatchString(h) {
				name, _ := val[1].(string)
				desc, _ := val[2].(string)
				mode := 0
				for _, item := range val {
					if m, ok := item.(float64); ok && m > 0 && m < 100 {
						mode = int(m)
					}
				}
				if !seen[h] {
					seen[h] = true
					*out = append(*out, DiscoveredModel{
						HexID: h,
						Name:  name,
						Desc:  desc,
						Mode:  mode,
					})
				}
			}
		}
		for _, item := range val {
			findModelsInArray(item, out, seen)
		}
	case map[string]any:
		for _, item := range val {
			findModelsInArray(item, out, seen)
		}
	}
}

// DumpLiveModels calls batchexecute?rpcids=otAQ7b and prints live models available to the account.
func DumpLiveModels(cookie, proxyURL string, authuser int) error {
	sapisid := extractSAPISID(cookie)
	xsrf, err := getXSRF(cookie, authuser, proxyURL)
	if err != nil && cookie != "" {
		return fmt.Errorf("failed to fetch XSRF token: %w", err)
	}

	freq, _ := json.Marshal([]any{[]any{[]any{"otAQ7b", "[]", nil, "generic"}}})
	form := url.Values{"f.req": {string(freq)}}
	if xsrf != "" {
		form.Set("at", xsrf)
	}

	ep := fmt.Sprintf("%s/_/BardChatUi/data/batchexecute?rpcids=otAQ7b&bl=%s&hl=en&_reqid=%d&rt=c",
		geminiBase(authuser), currentBL(proxyURL), time.Now().UnixNano()%1000000)

	h := buildGeminiHeaders(cookie, sapisid, "")
	setAuthUserHeaders(h, authuser)
	delete(h, "x-goog-ext-525001261-jspb")

	st, _, body, err := uploadPost(ep, h, []byte(form.Encode()), proxyURL)
	if err != nil {
		return fmt.Errorf("otAQ7b request failed: %w", err)
	}
	if st != 200 {
		return fmt.Errorf("otAQ7b HTTP %d: %s", st, string(body))
	}

	payloads := wrbPayloads(string(body))
	if len(payloads) == 0 {
		fmt.Printf("Raw response:\n%s\n", string(body))
		return nil
	}

	var discovered []DiscoveredModel
	seen := make(map[string]bool)
	findModelsInArray(payloads, &discovered, seen)

	fmt.Println("=================================================================")
	fmt.Println("          Google Gemini otAQ7b Models Registry Dump              ")
	fmt.Println("=================================================================")
	if len(discovered) > 0 {
		fmt.Printf("%-18s | %-20s | %-6s | %s\n", "Hex ID", "Name", "Mode", "Description")
		fmt.Println("-------------------+----------------------+--------+-----------------------------")
		for _, m := range discovered {
			fmt.Printf("%-18s | %-20s | %-6d | %s\n", m.HexID, m.Name, m.Mode, m.Desc)
		}
		fmt.Println("=================================================================")
	}

	// Look for policy names like neon_launch_*
	bodyStr := string(body)
	if idx := strings.Index(bodyStr, "neon_launch"); idx >= 0 {
		end := idx + 40
		if end > len(bodyStr) {
			end = len(bodyStr)
		}
		fmt.Printf("[Policy Detected] %s...\n", bodyStr[idx:end])
		fmt.Println("=================================================================")
	}

	pretty, err := json.MarshalIndent(payloads, "", "  ")
	if err != nil {
		fmt.Println(bodyStr)
		return nil
	}
	fmt.Println("Full JSON Payload:")
	fmt.Println(string(pretty))
	return nil
}
