import { Mail, Phone, Wrench, X } from 'lucide-react'

type Props={onClose:()=>void}

export default function AboutContactPanel({onClose}:Props){
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="modal about-contact-modal" role="dialog" aria-modal="true" aria-labelledby="about-contact-title">
      <div className="modal-head">
        <div><div className="eyebrow">THÔNG TIN ỨNG DỤNG</div><h2 id="about-contact-title">Giới thiệu / Liên hệ</h2><p>Thông tin về BAOTRI Mini và kênh liên hệ hỗ trợ.</p></div>
        <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={17}/></button>
      </div>
      <div className="about-contact-hero">
        <div className="about-contact-brand-icon"><Wrench size={25}/></div>
        <div><h3>BAOTRI Mini</h3><p>Hệ thống hỗ trợ quản lý thiết bị, bảo dưỡng – sửa chữa, kiểm tra định kỳ (Checklist), kho vật tư và theo dõi hoạt động bảo trì trong doanh nghiệp.</p></div>
      </div>
      <section className="about-contact-section">
        <h3>Liên hệ</h3>
        <div className="about-contact-grid">
          <div className="about-contact-card"><span className="about-contact-card-icon"><Phone size={18}/></span><div><small>Điện thoại</small><a href="tel:0912500396">0912 500 396</a></div></div>
          <div className="about-contact-card"><span className="about-contact-card-icon"><Mail size={18}/></span><div><small>Email</small><a href="mailto:tuanluongpham@gmail.com">tuanluongpham@gmail.com</a></div></div>
        </div>
      </section>
      <p className="about-contact-footnote">Bạn có thể gọi điện hoặc gửi email để trao đổi, góp ý và liên hệ về BAOTRI Mini.</p>
      <div className="modal-actions"><button type="button" className="primary-btn" onClick={onClose}>Đóng</button></div>
    </section>
  </div>
}
