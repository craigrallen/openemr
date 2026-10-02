<?php

/**
 * Read-back verification of a seeded fixture. Every expectation is derived
 * from the fixture (counts, natural keys, relationships), so a missing table,
 * row or link fails even when the database holds nothing to iterate over.
 * Output names synthetic pubpids and entry types only.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class SeedVerifier
{
    public function __construct(private readonly SeedGateway $db)
    {
    }

    public function verify(Fixture $fixture): VerifyReport
    {
        $r = new VerifyReport();
        if ($fixture->patients === []) {
            $r->fail('fixture: no patients expected; nothing to verify');
        }
        foreach ($fixture->staff as $s) {
            $u = $this->db->findOne('users', ['username' => Val::str($s, 'username')]);
            $r->expect($u !== null && str_contains((string) $u['info'], $fixture->marker()), 'user:provider', 'staff ' . Val::str($s, 'key'));
        }
        $r->expect($this->db->findOne('facility', ['name' => Val::str($fixture->facility, 'name')]) !== null, 'facility', 'facility');
        foreach ($fixture->insurers as $i) {
            $r->expect($this->db->findOne('insurance_companies', ['name' => Val::str($i, 'name')]) !== null, 'insurance_company', Val::str($i, 'key'));
        }
        $lab = $this->db->findOne('procedure_providers', ['name' => Val::str($fixture->lab, 'name')]);
        $r->expect($lab !== null, 'procedure_provider', 'lab');
        foreach (Val::list($fixture->lab, 'tests') as $t) {
            foreach (['ord', 'res'] as $type) {
                $found = $lab !== null && $this->db->findOne('procedure_type', ['lab_id' => $lab['ppid'], 'procedure_code' => Val::str($t, 'code'), 'procedure_type' => $type]) !== null;
                $r->expect($found, 'procedure_type', Val::str($t, 'code') . " {$type}");
            }
        }
        foreach ($fixture->providerBlocks as $b) {
            $r->expect($this->db->findOne('openemr_postcalendar_events', ['pc_hometext' => $fixture->marker('block:' . Val::str($b, 'key'))]) !== null, 'calendar:provider_blocks', Val::str($b, 'key'));
        }
        foreach ($fixture->clinicEvents as $e) {
            foreach ($fixture->staff as $s) {
                if (Val::int($s, 'calendar') === 1 && Val::int($s, 'authorized') === 1) {
                    $marker = $fixture->marker('clinic:' . Val::str($e, 'key') . ':' . Val::str($s, 'key'));
                    $r->expect($this->db->findOne('openemr_postcalendar_events', ['pc_hometext' => $marker]) !== null, 'calendar:clinic_events', Val::str($e, 'key') . ' ' . Val::str($s, 'key'));
                }
            }
        }
        foreach ($fixture->officeNotes as $n) {
            $body = Val::str($n, 'body') . ' ' . $fixture->marker('onote:' . Val::str($n, 'key'));
            $r->expect($this->db->findOne('onotes', ['body' => $body]) !== null, 'office_note', Val::str($n, 'key'));
        }
        foreach ($fixture->patients as $p) {
            foreach ($this->checkPatient($fixture, $p, $r) as $failure) {
                $r->fail($failure);
            }
        }
        return $r;
    }

    /**
     * Failures for one fixture patient's subtree; empty when it is complete.
     *
     * @param array<string, mixed> $p
     * @return list<string>
     */
    public function verifyPatient(Fixture $fixture, array $p): array
    {
        return $this->checkPatient($fixture, $p, new VerifyReport());
    }

    /**
     * @param array<string, mixed> $p
     * @return list<string>
     */
    private function checkPatient(Fixture $fixture, array $p, VerifyReport $counts): array
    {
        $r = new VerifyReport();
        $pubpid = Val::str($p, 'pubpid');
        $pd = $this->db->findOne('patient_data', ['pubpid' => $pubpid]);
        if ($pd === null || ($pd['genericval1'] ?? '') !== $fixture->seedKey) {
            return ["{$pubpid}: patient missing or not marked"];
        }
        $counts->count('lbf:DEM');
        $r->expect(($pd['uuid'] ?? '') !== '' && $pd['uuid'] !== null, 'lbf:DEM', "{$pubpid} uuid");
        $pid = (int) $pd['pid'];

        $r->expectCount(1, count($this->db->findAll('history_data', ['pid' => $pid])), 'lbf:HIS', $pubpid);
        $r->expectCount(count(Val::list($p, 'insurance')), count($this->db->findAll('insurance_data', ['pid' => $pid])), 'insurance_data', $pubpid);

        $expected = array_map(static fn(array $i): string => Val::str($i, 'type') . '|' . Val::str($i, 'title'), Val::list($p, 'issues'));
        $actual = array_map(static fn(array $l): string => (string) $l['type'] . '|' . (string) $l['title'], $this->db->findAll('lists', ['pid' => $pid]));
        $this->expectSame($r, $expected, $actual, 'issues', $pubpid);
        foreach ($actual as $key) {
            $counts->count('issue:' . strstr($key, '|', true));
        }

        $reasons = [];
        foreach (Val::list($p, 'encounters') as $e) {
            $reasons[Val::str($e, 'key')] = Val::str($e, 'reason');
        }
        $expected = [];
        foreach (Val::list($p, 'issues') as $i) {
            if (isset($i['encounter'])) {
                $expected[] = Val::str($i, 'type') . '|' . Val::str($i, 'title') . '|' . ($reasons[Val::str($i, 'encounter')] ?? 'missing-encounter');
            }
        }
        $actual = [];
        foreach ($this->db->findAll('issue_encounter', ['pid' => $pid]) as $link) {
            $issue = $this->db->findOne('lists', ['id' => $link['list_id'], 'pid' => $pid]);
            $fe = $this->db->findOne('form_encounter', ['pid' => $pid, 'encounter' => $link['encounter']]);
            $actual[] = (string) ($issue['type'] ?? 'unlinked') . '|' . (string) ($issue['title'] ?? 'unlinked') . '|' . (string) ($fe['reason'] ?? 'unlinked');
        }
        $this->expectSame($r, $expected, $actual, 'issue_encounter', $pubpid);

        $expected = array_map(static fn(array $x): string => Val::str($x, 'drug'), Val::list($p, 'prescriptions'));
        $actual = array_map(static fn(array $x): string => (string) $x['drug'], $this->db->findAll('prescriptions', ['patient_id' => $pid]));
        $this->expectSame($r, $expected, $actual, 'prescription', $pubpid);
        $counts->count('prescription', count($actual));

        $expected = array_map(static fn(array $x): string => Val::str($x, 'cvx'), Val::list($p, 'immunizations'));
        $actual = array_map(static fn(array $x): string => (string) $x['cvx_code'], $this->db->findAll('immunizations', ['patient_id' => $pid]));
        $this->expectSame($r, $expected, $actual, 'immunization', $pubpid);
        $counts->count('immunization', count($actual));

        $expected = array_map(static fn(array $a): string => Val::str($a, 'status') . '|' . Val::str($a, 'title'), Val::list($p, 'appointments'));
        $appointments = $this->db->findAll('openemr_postcalendar_events', ['pc_pid' => (string) $pid]);
        $actual = array_map(static fn(array $a): string => (string) $a['pc_apptstatus'] . '|' . (string) $a['pc_title'], $appointments);
        $this->expectSame($r, $expected, $actual, 'appointment', $pubpid);
        foreach ($appointments as $a) {
            $counts->count('appointment:status ' . (string) $a['pc_apptstatus']);
        }

        $expected = [];
        foreach (Val::list($p, 'documents') as $doc) {
            $category = $this->db->findOne('categories', ['name' => Val::str($doc, 'category')]);
            $expected[] = Val::str($doc, 'name') . '|' . (string) ($category['id'] ?? 'missing-category');
        }
        $actual = [];
        foreach ($this->db->findAll('documents', ['foreign_id' => $pid]) as $doc) {
            $link = $this->db->findOne('categories_to_documents', ['document_id' => $doc['id']]);
            $actual[] = (string) $doc['name'] . '|' . (string) ($link['category_id'] ?? 'unlinked');
        }
        $this->expectSame($r, $expected, $actual, 'document', $pubpid);
        $counts->count('document', count($actual));

        $expected = array_map(static fn(array $m): string => Val::str($m, 'title'), Val::list($p, 'messages'));
        $actual = array_map(static fn(array $m): string => (string) $m['title'], $this->db->findAll('pnotes', ['pid' => $pid]));
        $this->expectSame($r, $expected, $actual, 'message:internal', $pubpid);
        $counts->count('message:internal', count($actual));

        $expected = array_map(static fn(array $t): string => Val::str($t, 'form_id') . '|' . count(Val::map($t, 'fields')), Val::list($p, 'transactions'));
        $actual = [];
        foreach ($this->db->findAll('transactions', ['pid' => $pid]) as $t) {
            $actual[] = (string) $t['title'] . '|' . count($this->db->findAll('lbt_data', ['form_id' => $t['id']]));
            $counts->count('lbf:' . (string) $t['title']);
        }
        $this->expectSame($r, $expected, $actual, 'transactions', $pubpid);

        $encounters = $this->db->findAll('form_encounter', ['pid' => $pid]);
        $r->expectCount(count(Val::list($p, 'encounters')), count($encounters), 'form:newpatient', $pubpid);
        foreach (Val::list($p, 'encounters') as $e) {
            $fe = $this->db->findOne('form_encounter', ['pid' => $pid, 'reason' => Val::str($e, 'reason')]);
            if ($fe === null) {
                $r->fail("form:newpatient: {$pubpid} encounter " . Val::str($e, 'key') . ' missing');
                continue;
            }
            $this->verifyEncounter($fixture, $r, $counts, $e, "{$pubpid} encounter " . Val::str($e, 'key'), $pid, (int) $fe['encounter'], (int) $fe['id']);
        }
        return $r->failures;
    }

    /** @param array<string, mixed> $e */
    private function verifyEncounter(Fixture $fixture, VerifyReport $r, VerifyReport $counts, array $e, string $label, int $pid, int $encounter, int $feId): void
    {
        $forms = Val::map($e, 'forms');
        $order = Val::map($e, 'lab_order');
        $expected = array_merge(['newpatient'], array_keys($forms), $order === [] ? [] : ['procedure_order']);
        $rows = $this->db->findAll('forms', ['pid' => $pid, 'encounter' => $encounter]);
        $this->expectSame($r, $expected, array_map(static fn(array $f): string => (string) $f['formdir'], $rows), 'forms', $label);
        foreach ($rows as $form) {
            $formdir = (string) $form['formdir'];
            $counts->count('form:' . $formdir);
            if ($formdir === 'newpatient') {
                $r->expect((int) $form['form_id'] === $feId, 'form:newpatient', "{$label} forms.form_id link");
            } elseif ($formdir === 'procedure_order') {
                $r->expect($this->db->findOne('procedure_order', ['procedure_order_id' => $form['form_id'], 'patient_id' => $pid, 'encounter_id' => $encounter]) !== null, 'form:procedure_order', "{$label} forms.form_id link");
            } elseif (FormCatalog::isSeedable($formdir) && isset($forms[$formdir]) && is_array($forms[$formdir])) {
                [$table, , $grouping] = FormCatalog::get($formdir);
                $want = $grouping === 'single' ? 1 : count(array_is_list($forms[$formdir]) ? $forms[$formdir] : [$forms[$formdir]]);
                $found = count($this->db->findAll($table, [FormCatalog::linkColumn($formdir) => $form['form_id'], 'pid' => $pid]));
                $r->expectCount($want, $found, 'form:' . $formdir, "{$label} {$table} rows");
            }
        }

        $fees = Val::list($e, 'fees');
        $billing = $this->db->findAll('billing', ['pid' => $pid, 'encounter' => $encounter]);
        $this->expectSame(
            $r,
            array_map(static fn(array $f): string => Val::str($f, 'code_type') . '|' . Val::str($f, 'code') . '|' . Val::str($f, 'fee'), $fees),
            array_map(static fn(array $b): string => (string) $b['code_type'] . '|' . (string) $b['code'] . '|' . (string) $b['fee'], $billing),
            'form:fee_sheet',
            $label,
        );
        $counts->count('form:fee_sheet', count($billing));

        $copays = $this->db->findAll('payments', ['pid' => $pid, 'encounter' => $encounter]);
        $r->expectCount(Val::map($e, 'copay') === [] ? 0 : 1, count($copays), 'payment:front_desk_copay', $label);
        $counts->count('payment:front_desk_copay', count($copays));

        $expected = [];
        foreach (Val::list($e, 'payments') as $pay) {
            $type = Val::str($pay, 'payer') === 'insurance' ? 'insurance' : 'patient';
            $expected[] = "{$type}|pay|" . Val::str($pay, 'amount');
            if (Val::str($pay, 'adjustment', '') !== '') {
                $expected[] = "{$type}|adj|" . Val::str($pay, 'adjustment');
            }
        }
        $actual = [];
        foreach ($this->db->findAll('ar_activity', ['pid' => $pid, 'encounter' => $encounter]) as $act) {
            $session = $this->db->findOne('ar_session', ['session_id' => $act['session_id']]);
            $type = (string) ($session['payment_type'] ?? 'unlinked');
            $actual[] = (string) $act['adj_amount'] === '0.00' ? "{$type}|pay|" . (string) $act['pay_amount'] : "{$type}|adj|" . (string) $act['adj_amount'];
            $counts->count($type === 'insurance' ? 'payment:insurance' : 'payment:patient');
        }
        $this->expectSame($r, $expected, $actual, 'payment', $label);

        $orders = $this->db->findAll('procedure_order', ['patient_id' => $pid, 'encounter_id' => $encounter]);
        $r->expectCount($order === [] ? 0 : 1, count($orders), 'form:procedure_order', $label);
        if ($order === [] || count($orders) !== 1) {
            return;
        }
        $orderId = $orders[0]['procedure_order_id'];
        $standard = [];
        foreach (Val::list($fixture->lab, 'tests') as $t) {
            $standard[Val::str($t, 'code')] = DemoSeeder::bareLoinc(Val::str($t, 'standard_code'));
        }
        $codes = $this->db->findAll('procedure_order_code', ['procedure_order_id' => $orderId]);
        $this->expectSame($r, array_map(static fn(array $t): string => Val::str($t, 'value'), Val::list($order, 'lab_tests')), array_map(static fn(array $c): string => (string) $c['procedure_code'], $codes), 'form:procedure_order', "{$label} order codes");
        $expected = array_map(static fn(array $res): string => ($standard[Val::str($res, 'code')] ?? '?') . '|' . Val::str($res, 'value'), Val::list($order, 'results'));
        $actual = [];
        foreach ($this->db->findAll('procedure_report', ['procedure_order_id' => $orderId]) as $report) {
            foreach ($this->db->findAll('procedure_result', ['procedure_report_id' => $report['procedure_report_id']]) as $res) {
                $actual[] = (string) $res['result_code'] . '|' . (string) $res['result'];
            }
            $counts->count('procedure_report');
        }
        $this->expectSame($r, $expected, $actual, 'procedure_result', $label);
        $counts->count('procedure_result', count($actual));
    }

    /**
     * Multiset comparison; an expected non-empty collection with no rows fails.
     *
     * @param list<string> $expected
     * @param list<string> $actual
     */
    private function expectSame(VerifyReport $r, array $expected, array $actual, string $type, string $what): void
    {
        sort($expected);
        sort($actual);
        $r->expect($expected === $actual, $type, "{$what} expected [" . implode(', ', $expected) . '], found [' . implode(', ', $actual) . ']');
    }
}
