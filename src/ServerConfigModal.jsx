import { useState } from 'react'
import { FiServer, FiLock, FiUser, FiHash, FiX } from 'react-icons/fi'

function uuid() {
  var s = [];
  var hexDigits = "0123456789abcdef";
  for (var i = 0; i < 36; i++) {
    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
  }
  s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
  s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
  s[8] = s[13] = s[18] = s[23] = "-";

  var uuid = s.join("");
  return uuid;
}

export default function ServerConfigModal({
  visible,
  onCancel,
  onSave
}) {
  /** @type {Props} */
  const [form, setForm] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    path: '/'
  })

  const handleSubmit = () => {
    if (!form.host || !form.username) {
      alert('请填写必填项')
      return
    }
    if (!/^\d+$/.test(form.port?.toString() || '')) {
      alert('端口号必须为数字')
      return
    }

    form.id = uuid()
    onSave(form)
  }

  if (!visible) return null

  return (
    <div className="modal-mask">
      <div className="modal-container">
        <div className="modal-header">
          <h3>
            <FiServer className="modal-icon" />
            远程sftp服务器配置
          </h3>
          <button className="modal-close-btn" onClick={onCancel}>
            <FiX />
          </button>
        </div>

        <div className="form-group">
          <label>
            <FiServer className="input-icon" />
            主机地址*
          </label>
          <input
            value={form.host}
            onChange={e => setForm({ ...form, host: e.target.value })}
            placeholder="sftp.example.com"
          />
        </div>

        <div className="form-group">
          <label>
            <FiHash className="input-icon" />
            端口
          </label>
          <input
            type="number"
            min="1"
            max="65535"
            value={form.port}
            onChange={e => setForm({ ...form, port: Number(e.target.value) })}
            placeholder="22"
          />
        </div>

        <div className="form-group">
          <label>
            <FiUser className="input-icon" />
            用户名*
          </label>
          <input
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>
            <FiLock className="input-icon" />
            密码*
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
        </div>

        {/* <div className="form-group">
          <label>音乐路径</label>
          <input
            value={form.path}
            onChange={e => setForm({ ...form, path: e.target.value })}
            placeholder="/music"
          />
        </div> */}

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel}>取消</button>
          <button className="confirm-btn" onClick={handleSubmit}>保存</button>
        </div>
      </div>
    </div>
  )
}
