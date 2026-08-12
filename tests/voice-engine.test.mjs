import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseChildFriendlyVoice,
  getChildVoiceProfile,
  isChildVoiceStyle,
  prepareChildSpeech,
} from "../app/voice-engine.ts";

const voice = (name, lang, options = {}) => ({ name, lang, default: false, localService: true, ...options });

test("child voice selection prefers a friendly mainland Mandarin voice", () => {
  const voices = [
    voice("English Samantha", "en-US"),
    voice("Microsoft Yunyang", "zh-CN"),
    voice("Microsoft Xiaoxiao Natural", "zh-CN"),
    voice("Mei-Jia", "zh-TW"),
  ];
  assert.equal(chooseChildFriendlyVoice(voices, "playmate", "anqi")?.name, "Microsoft Xiaoxiao Natural");
  assert.equal(chooseChildFriendlyVoice(voices, "gentle", "npc")?.name, "Microsoft Xiaoxiao Natural");
});

test("voice profiles keep coaching slower and avoid cartoonishly high pitch", () => {
  const companion = getChildVoiceProfile("playmate", "anqi");
  const coach = getChildVoiceProfile("playmate", "coach");
  assert.ok(coach.rate < companion.rate);
  assert.ok(companion.pitch <= 1.08);
  assert.ok(companion.volume >= 0.7);
});

test("speech copy gains natural pauses and settings reject unknown modes", () => {
  assert.equal(prepareChildSpeech("茉茉说：没关系 · 我们继续", "npc"), "茉茉说，没关系，我们继续");
  assert.match(prepareChildSpeech("没关系，先找到 F，慢慢按。", "coach"), /^没关系。我们慢慢来，/);
  assert.equal(isChildVoiceStyle("playmate"), true);
  assert.equal(isChildVoiceStyle("robot"), false);
});

