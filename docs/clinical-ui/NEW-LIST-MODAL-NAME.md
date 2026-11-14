# OPEMR-232: New List modal name

The New List dialog root gains `aria-label="<?php echo xla('New List'); ?>"`. The visible translated heading and all other production bytes remain unchanged. The source contract compares the candidate with the pinned original fixture after removing exactly that addition. It also checks the launcher, title, controls, and negative mutations.

Controller source contract command: `node tests/clinical-ui/new-list-modal-name-contract.cjs`. The Jest adapter is hosted-only; local adapter execution is denied.

Tests-first controller execution at tests-only commit `0bc25a60`: 22 checks, 21 passed and one semantic failure (the actual dialog's missing translated name). After the one-attribute addition: 22/22 passed with empty stderr; PHP lint, Node syntax and `git diff --check` passed. The contract includes exact whole-source preservation and negative controls. No local Jest or application bootstrap ran.

The wrapped Codex Sol implementer supplied the complete test proposal and the exact intended root addition. A second proposal corrected the adapter's absolute-end framing before materialization. Its decoded replacement text still contained escaped single quotes; the controller materialized the reviewed intended literal PHP quotes rather than those invalid transport characters. Production remains exactly the one attribute specified in the issue, and the source inverse verifies it. Independent review must inspect this correction with all five complete artifacts.

Independent review remains open, including native authenticated keyboard and assistive technology behavior, roles, persistence, clinical behavior, ordinary approval, and CI. This source contract does not establish browser, accessibility, runtime, or security acceptance. No merge or deploy is included. Scope is this popup only; it does not cover the full UI, all 22 items, Swedish translation behavior, or a demo.
