<?php
declare(strict_types=1);
// "Which test should I take?" — ported from Arogya's AI test finder. Uses
// Gemini when GEMINI_API_KEY is set, otherwise a keyword match on the catalogue.
// Suggestions only ever come from the centre's own active catalogue.

function find_tests(string $query): array {
    $query = trim(mb_substr($query, 0, 500));
    if ($query === '') throw new InvalidArgumentException('Describe what you want to check.');
    $tests = db()->query('SELECT id, name, category, description, price FROM tests WHERE is_active=1')->fetchAll();
    $pkgs = db()->query('SELECT id, name, description, price FROM packages WHERE is_active=1')->fetchAll();
    $ai = getenv('GEMINI_API_KEY') ? finder_ai($query, $tests, $pkgs) : null;
    return $ai ?? finder_keywords($query, $tests, $pkgs);
}

function finder_keywords(string $q, array $tests, array $pkgs): array {
    // Everyday words mapped to catalogue terms, so "tired" or "sugar" still finds something
    $syn = ['sugar' => 'glucose sugar hba1c diabetes', 'diabetes' => 'glucose sugar hba1c', 'tired' => 'cbc thyroid tsh vitamin iron', 'weak' => 'cbc vitamin iron',
            'thyroid' => 'tsh thyroid', 'weight' => 'thyroid tsh lipid', 'liver' => 'lft liver', 'alcohol' => 'lft liver', 'kidney' => 'kft kidney creatinine urine',
            'urine' => 'urine kft', 'heart' => 'lipid cholesterol', 'cholesterol' => 'lipid cholesterol', 'fever' => 'cbc', 'anaemia' => 'cbc iron', 'anemia' => 'cbc iron',
            'checkup' => 'full body checkup', 'full body' => 'full body checkup'];
    $words = strtolower($q);
    foreach ($syn as $k => $v) if (str_contains($words, $k)) $words .= ' ' . $v;
    $terms = array_filter(array_unique(preg_split('/[^a-z0-9]+/', $words)), fn($t) => strlen($t) >= 3);
    $score = function (array $row) use ($terms): int {
        $hay = strtolower($row['name'] . ' ' . ($row['category'] ?? '') . ' ' . ($row['description'] ?? '') . ' ' . ($row['code'] ?? ''));
        $n = 0; foreach ($terms as $t) if (str_contains($hay, $t)) $n++;
        return $n;
    };
    $out = ['source' => 'keywords', 'summary' => '', 'tests' => [], 'packages' => []];
    foreach ($tests as $t) if (($s = $score($t)) > 0) $out['tests'][] = $t + ['score' => $s, 'why' => 'Matches what you described.'];
    foreach ($pkgs as $p) if (($s = $score($p)) > 0) $out['packages'][] = $p + ['score' => $s, 'why' => 'Covers several related tests.'];
    usort($out['tests'], fn($a, $b) => $b['score'] <=> $a['score']);
    $out['tests'] = array_slice($out['tests'], 0, 5);
    $out['summary'] = $out['tests'] || $out['packages'] ? 'Tests in our catalogue that match your words.' : 'No direct match. A full body checkup is a good start, or ask our team.';
    return $out;
}

function finder_ai(string $q, array $tests, array $pkgs): ?array {
    $catalog = implode("\n", array_merge(
        array_map(fn($t) => "T{$t['id']}: {$t['name']}" . ($t['category'] ? " [{$t['category']}]" : ''), $tests),
        array_map(fn($p) => "P{$p['id']}: {$p['name']} — " . mb_substr((string)$p['description'], 0, 80), $pkgs)));
    $prompt = "You help patients of a diagnostic lab pick tests. Only choose ids from this catalogue:\n$catalog\n\n"
        . "Patient says: \"" . str_replace('"', "'", $q) . "\"\n\n"
        . "Reply with JSON only: {\"summary\": one short sentence, \"items\": [{\"id\": \"T1\" or \"P1\", \"why\": short reason}]} with at most 5 items. "
        . "If the message describes an emergency (chest pain, trouble breathing, heavy bleeding, fainting), set summary to advise urgent medical care and return no items. Do not diagnose.";
    $model = getenv('GEMINI_MODEL') ?: 'gemini-2.0-flash';
    $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . urlencode((string)getenv('GEMINI_API_KEY')));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['contents' => [['parts' => [['text' => $prompt]]]], 'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0.2]])]);
    $res = json_decode((string)curl_exec($ch), true); curl_close($ch);
    $text = $res['candidates'][0]['content']['parts'][0]['text'] ?? null;
    $j = $text ? json_decode($text, true) : null;
    if (!is_array($j) || !isset($j['items']) || !is_array($j['items'])) return null;   // fall back to keywords
    $byT = array_column($tests, null, 'id'); $byP = array_column($pkgs, null, 'id');
    $out = ['source' => 'ai', 'summary' => mb_substr((string)($j['summary'] ?? ''), 0, 300), 'tests' => [], 'packages' => []];
    foreach (array_slice($j['items'], 0, 5) as $it) {
        $id = (string)($it['id'] ?? ''); $why = mb_substr((string)($it['why'] ?? ''), 0, 200);
        // Never trust ids the model invents: keep only real catalogue entries
        if (preg_match('/^T(\d+)$/', $id, $m) && isset($byT[$m[1]])) $out['tests'][] = $byT[$m[1]] + ['why' => $why];
        elseif (preg_match('/^P(\d+)$/', $id, $m) && isset($byP[$m[1]])) $out['packages'][] = $byP[$m[1]] + ['why' => $why];
    }
    return $out;
}
