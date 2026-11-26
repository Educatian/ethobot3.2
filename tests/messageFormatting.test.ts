import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMessageText } from '../utils/messageFormatting.ts';

test('renders HTML-like learner and model content as text', () => {
  const result = formatMessageText('<b title="example">learner & model</b>');
  assert.equal(result, '&lt;b title=&quot;example&quot;&gt;learner &amp; model&lt;/b&gt;');
  assert.equal(formatMessageText('&lt;b&gt;'), '&amp;lt;b&amp;gt;');
});

test('preserves supported emphasis, line breaks and Korean text', () => {
  assert.equal(formatMessageText('**근거**\n*관점*'), '<strong>근거</strong><br /><em>관점</em>');
  assert.equal(formatMessageText('**<b>text</b>**'), '<strong>&lt;b&gt;text&lt;/b&gt;</strong>');
});
