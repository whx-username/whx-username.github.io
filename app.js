const $ = (id) => document.getElementById(id);
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
const channel = pc.createDataChannel('control');
const localCandidates = [];

function log(text, kind = 'dim') {
  const line = document.createElement('div');
  line.className = `log-line ${kind}`;
  line.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  $('log').appendChild(line);
  $('log').scrollTop = $('log').scrollHeight;
}
function setStatus(text, good = false) {
  $('status').textContent = text;
  $('status-dot').className = `dot ${good ? 'good' : ''}`;
}
function waitForIceGathering() {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => pc.addEventListener('icegatheringstatechange', () => {
    if (pc.iceGatheringState === 'complete') resolve();
  }));
}

pc.onicecandidate = event => { if (event.candidate) localCandidates.push(event.candidate.toJSON()); };
pc.oniceconnectionstatechange = () => {
  const state = pc.iceConnectionState;
  setStatus(state, state === 'connected' || state === 'completed');
  log(`ICE 状态: ${state}`);
};
pc.onconnectionstatechange = () => log(`连接状态: ${pc.connectionState}`);

channel.onopen = () => {
  $('channel-state').textContent = '已建立';
  $('channel-state').classList.remove('muted');
  setStatus('已连接', true);
  log('DataChannel 已建立', 'out');
};
channel.onclose = () => { $('channel-state').textContent = '已关闭'; log('DataChannel 已关闭'); };
channel.onmessage = event => {
  try {
    const message = JSON.parse(event.data);
    log(`Agent ← ${message.type}: ${message.text ?? ''}`, 'out');
  } catch { log(`Agent ← ${event.data}`, 'out'); }
};

$('create-offer').onclick = async () => {
  $('create-offer').disabled = true;
  localCandidates.length = 0;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering();
  $('offer').value = pc.localDescription.sdp;
  $('local-ice').value = JSON.stringify(localCandidates, null, 2);
  log('Offer 已生成，请复制给 Agent', 'out');
};
$('apply-answer').onclick = async () => {
  try {
    await pc.setRemoteDescription({ type: 'answer', sdp: $('answer').value.trim() });
    const candidates = JSON.parse($('remote-ice').value || '[]');
    for (const candidate of candidates) await pc.addIceCandidate(candidate);
    log('Answer 和远端 ICE 已应用', 'out');
  } catch (error) { log(`应用失败: ${error.message}`); }
};
$('copy-offer').onclick = async () => {
  await navigator.clipboard.writeText($('offer').value);
  log('Offer 已复制到剪贴板', 'out');
};
$('send').onclick = () => {
  const text = $('message').value.trim();
  if (!text) return;
  if (channel.readyState !== 'open') return log('DataChannel 尚未建立');
  channel.send(JSON.stringify({ type: text === 'ping' ? 'ping' : 'message', text }));
  log(`网页 → Agent: ${text}`, 'in');
};
$('message').onkeydown = event => { if (event.key === 'Enter') $('send').click(); };
document.querySelectorAll('[data-message]').forEach(button => button.onclick = () => {
  $('message').value = button.dataset.message;
  $('send').click();
});
$('clear-log').onclick = () => { $('log').innerHTML = ''; };
log('请先点击“创建 Offer”');
