const $ = id => document.getElementById(id);
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
const channel = pc.createDataChannel('control');

function log(text) {
  $('log').textContent += `\n${new Date().toLocaleTimeString()} ${text}`;
  $('log').scrollTop = $('log').scrollHeight;
}

function waitForIceGathering() {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => pc.addEventListener('icegatheringstatechange', () => {
    if (pc.iceGatheringState === 'complete') resolve();
  }));
}

pc.oniceconnectionstatechange = () => {
  $('status').textContent = pc.iceConnectionState;
  log(`ICE 状态: ${pc.iceConnectionState}`);
};

pc.onconnectionstatechange = () => log(`连接状态: ${pc.connectionState}`);

channel.onopen = () => {
  $('channel-state').textContent = '已建立';
  log('DataChannel 已建立');
};

channel.onclose = () => {
  $('channel-state').textContent = '已关闭';
  log('DataChannel 已关闭');
};

channel.onmessage = event => {
  try {
    const message = JSON.parse(event.data);
    log(`Agent -> ${message.type}: ${message.text || ''}`);
  } catch {
    log(`Agent -> ${event.data}`);
  }
};

$('create-offer').onclick = async () => {
  $('create-offer').disabled = true;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering();
  $('offer').value = pc.localDescription.sdp;
  log('Offer 已生成，请复制给 Agent');
};

function normalizeSdp(sdp) {
  return sdp
    .replace(/^a=end-of-candidates\s*$/gim, '')
    .replace(/\r?\n{3,}/g, '\n\n')
    .trim();
}

$('apply-answer').onclick = async () => {
  try {
    const answer = normalizeSdp($('answer').value);
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answer
    });
    log('Answer 已应用，等待连接');
  } catch (error) {
    log(`应用 Answer 失败: ${error.message}`);
  }
};

$('copy-offer').onclick = async () => {
  await navigator.clipboard.writeText($('offer').value);
  log('Offer 已复制');
};

$('send').onclick = () => {
  const text = $('message').value.trim();
  if (!text) return;
  if (channel.readyState !== 'open') return log('DataChannel 尚未建立');
  channel.send(JSON.stringify({ type: text === 'ping' ? 'ping' : 'message', text }));
  log(`网页 -> Agent: ${text}`);
};

$('message').onkeydown = event => {
  if (event.key === 'Enter') $('send').click();
};

document.querySelectorAll('[data-message]').forEach(button => {
  button.onclick = () => {
    $('message').value = button.dataset.message;
    $('send').click();
  };
});

$('clear-log').onclick = () => {
  $('log').textContent = '';
};

log('请先点击“创建 Offer”');
