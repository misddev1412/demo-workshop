"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { fetchProducts, restoreCart, type Product, type Cart } from "../lib/products";
import CheckoutForm from "./components/checkout-form";
import { shippingFee, type OrderReceipt } from "../lib/checkout";

type IconName = "bag" | "search" | "arrow" | "leaf" | "truck" | "return" | "heart" | "close" | "plus" | "minus" | "check";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: <><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    leaf: <><path d="M20 3C8 2 2 8 5 15s16 7 15-12Z"/><path d="M4 21 15 10"/></>,
    truck: <><path d="M2 5h12v12H2zM14 9h4l4 5v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    return: <><path d="m8 3-5 5 5 5M3 8h11a7 7 0 0 1 0 14"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>, plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>, check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const money = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const photo = (id: string, width = 700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const valid = product.image_url && /^https?:\/\//.test(product.image_url);
  return valid && !failed ? <Image src={product.image_url!} alt={product.name} fill unoptimized sizes="(max-width: 700px) 50vw, 33vw" onError={() => setFailed(true)}/> : <span className="image-placeholder">Chưa có ảnh</span>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<Product | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailDialog = useRef<HTMLDialogElement>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const detailId = useRef("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState<Cart>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [order, setOrder] = useState<OrderReceipt | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({ signal: controller.signal }).then(rows => {
      if (controller.signal.aborted) return;
      setProducts(rows);
      try { setCart(restoreCart(JSON.parse(localStorage.getItem("moc-cart") || "{}"), rows)); } catch { setCart({}); }
      setReady(true);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => detailRequest.current?.abort(), []);
  function retry() { setLoading(true); setError(""); setAttempt(value => value + 1); }
  async function openDetail(id: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    detailId.current = id;
    setDetail(null); setDetailError(""); setDetailLoading(true);
    if (!detailDialog.current?.open) detailDialog.current?.showModal();
    try {
      const rows = await fetchProducts({ id, signal: controller.signal });
      if (controller.signal.aborted) return;
      setDetail(rows[0] ?? null);
      // Keep prices/names used by the cart in sync with the freshly read detail.
      setProducts(previous => rows[0] ? previous.map(p => p.id === id ? rows[0] : p) : previous.filter(p => p.id !== id));
      if (!rows[0]) setCart(previous => { const next = { ...previous }; delete next[id]; return next; });
    } catch (cause) {
      if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : "Không thể tải chi tiết.");
    } finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  useEffect(() => { if (ready) { try { localStorage.setItem("moc-cart", JSON.stringify(cart)); } catch {} } }, [cart, ready]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { if (searchOpen) search.current?.focus(); }, [searchOpen]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0);
  const visible = products.filter(p => p.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))).sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : a.id.localeCompare(b.id));
  function change(id: string, delta: number) { setCart(previous => { const next = { ...previous, [id]: Math.min(99, Math.max(0, (previous[id] || 0) + delta)) }; if (!next[id]) delete next[id]; return next; }); }
  function openCart() { setOrder(null); setCheckingOut(false); dialog.current?.showModal(); }
  async function refreshCheckout() {
    const rows = await fetchProducts();
    setProducts(rows);
    setCart(previous => restoreCart(previous, rows));
  }
  return <>
    <div className="announcement"><Icon name="truck" size={15}/><span>Gửi chút yêu thương — Miễn phí vận chuyển cho đơn từ 499.000đ</span><span className="announcement-star">✳</span></div>
    <header className="header wrap">
      <a className="logo" href="#" aria-label="mộc. Trang chủ">mộc<span>.</span><i>EVERYDAY, MINDFULLY</i></a>
      <nav aria-label="Điều hướng chính"><a className="active" href="#products">Cửa hàng</a><a href="#story">Câu chuyện của mộc</a><a href="#footer">Kết nối</a></nav>
      <div className="header-actions"><button className="icon-button" aria-label="Tìm sản phẩm" onClick={() => setSearchOpen(!searchOpen)}><Icon name="search"/></button><span className="divider"/><button className="cart-button" aria-label={`Giỏ hàng, ${count} sản phẩm`} onClick={openCart}><Icon name="bag"/><span>Giỏ hàng</span><b>{count}</b></button></div>
    </header>
    {searchOpen && <div className="search-bar wrap"><Icon name="search"/><input ref={search} placeholder="Tìm một điều nhỏ xinh…" aria-label="Tìm kiếm sản phẩm" value={query} onChange={e => { setQuery(e.target.value); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }}/><button className="icon-button" aria-label="Đóng tìm kiếm" onClick={() => { setSearchOpen(false); setQuery(""); }}><Icon name="close"/></button></div>}
    <main>
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span/> ÍT HƠN, NHƯNG Ý NGHĨA HƠN</div><h1>Những điều nhỏ.<br/>Một ngày <em>thật đẹp.</em></h1><p>Đồ dùng giản đơn, được chọn bằng sự tinh tế.<br className="desktop"/> Cùng mộc chăm chút những điều bình dị mỗi ngày.</p><a className="primary-button" href="#products">Khám phá cửa hàng <Icon name="arrow" size={18}/></a><div className="hero-foot"><span className="tiny-leaf"><Icon name="leaf" size={17}/></span> Chọn có tâm. Dùng dài lâu.</div></div>
        <div className="hero-image"><Image src={photo("photo-1449247709967-d4461a6a6103", 1200)} alt="Góc nhà ngập nắng với cây xanh, bàn gỗ và những vật dụng giản dị" fill priority unoptimized sizes="(max-width: 700px) 100vw, 55vw"/><div className="image-shade"/><div className="hero-stamp"><Icon name="leaf" size={27}/><span>ĐƠN GIẢN<br/>MÀ ĐỦ ĐẦY</span></div><div className="image-caption"><span>THE EVERYDAY COLLECTION</span><span>01 / 03 <span className="caption-line"/></span></div></div>
      </section>
      <section className="benefits wrap" aria-label="Cam kết của mộc"><div><Icon name="leaf"/><span>Chọn lọc từ những điều tốt</span></div><div><Icon name="truck"/><span>Giao hàng toàn quốc</span></div><div><Icon name="return"/><span>Đổi trả dễ dàng trong 7 ngày</span></div><div><Icon name="heart"/><span>Gói ghém bằng sự tận tâm</span></div></section>
      <section id="products" className="products-section wrap"><div className="section-heading"><div><div className="eyebrow">MỘT CHÚT MỘC, MỖI NGÀY</div><h2>Chọn cho mình một điều nhỏ</h2></div><span className="collection-note">Những món đồ bạn sẽ muốn dùng mỗi ngày.</span></div>
        <div className="filters"><div className="category-tabs"><button className="selected">Tất cả <small>{products.length}</small></button></div><label className="sort"><span>Sắp xếp:</span><select aria-label="Sắp xếp sản phẩm" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Mặc định</option><option value="low">Giá tăng dần</option><option value="high">Giá giảm dần</option></select></label></div>
        {query && <p className="search-result">Kết quả cho “{query}” · {visible.length} sản phẩm</p>}
        {loading && <div className="empty" role="status">Đang tải sản phẩm…</div>}
        {error && <div className="empty" role="alert"><p>{error}</p><button onClick={retry}>Thử lại</button></div>}
        {!loading && !error && <div className="product-grid">{visible.map(p => <article className="product" key={p.id} data-product-id={p.id}>
          <div className="product-image"><button className="product-preview" aria-label={`Xem chi tiết ${p.name}`} onClick={() => openDetail(p.id)}><ProductImage key={p.image_url} product={p}/></button><button className={`favorite ${favorites.includes(p.id) ? "is-favorite" : ""}`} aria-label={`Yêu thích ${p.name}`} aria-pressed={favorites.includes(p.id)} onClick={() => setFavorites(previous => previous.includes(p.id) ? previous.filter(id => id !== p.id) : [...previous, p.id])}><Icon name="heart" size={18}/></button></div>
          <h3><button className="product-title" onClick={() => openDetail(p.id)}>{p.name}</button></h3><div className="product-bottom"><div className="prices"><strong>{money(p.price)}</strong></div><button className="add-button" aria-label={`Thêm ${p.name} vào giỏ`} onClick={() => { change(p.id, 1); setToast(`Đã thêm ${p.name} vào giỏ`); }}><Icon name="plus" size={17}/><span>Thêm vào giỏ</span></button></div>
        </article>)}</div>}
        {!loading && !error && !visible.length && <div className="empty" role="status"><Icon name="search" size={30}/><h3>{products.length ? "Chưa tìm thấy món đồ phù hợp" : "Chưa có sản phẩm"}</h3>{query && <button onClick={() => setQuery("")}>Xem tất cả sản phẩm</button>}</div>}
        <div className="collection-end"><span/> Một bộ sưu tập nhỏ. Được chọn thật kỹ. <Icon name="leaf" size={16}/><span/></div>
      </section>
      <section className="story wrap" id="story"><div className="story-symbol">m<span>✳</span></div><div><div className="eyebrow">CHÚT TÂM TÌNH TỪ MỘC</div><h2>Không cần nhiều. Chỉ cần vừa đủ.</h2><p>Chúng mình tin rằng niềm vui nằm trong những điều rất nhỏ. Một chiếc ly yêu thích,<br className="desktop"/> một góc xanh trên bàn, hay chiếc túi cùng bạn đi khắp phố. Mộc ở đây, cùng bạn.</p></div><Icon name="leaf" size={64}/></section>
    </main>
    <footer id="footer" className="wrap"><div className="footer-main"><a href="#" className="logo">mộc<span>.</span></a><p>Giản đơn trong từng lựa chọn.</p><a href="mailto:hello@moc.example">Chào mộc một tiếng ↗</a></div><div className="footer-bottom"><span>© 2026 mộc. Được làm bằng sự tận tâm.</span><span>Cửa hàng mẫu · Giá hiển thị bằng VNĐ</span><span>Made with a little love ♡</span></div></footer>
    <div className={`toast ${toast ? "show" : ""}`} role="status"><Icon name="check" size={18}/>{toast}<button onClick={openCart}>Xem giỏ →</button></div>
    <dialog ref={dialog} className="cart-dialog" aria-labelledby="cart-title" onCancel={e => { if (placingOrder) e.preventDefault(); }} onClick={e => { if (!placingOrder && e.target === e.currentTarget) dialog.current?.close(); }}><div className="cart-panel"><div className="cart-heading"><div><span className="eyebrow">NHỮNG ĐIỀU BẠN ĐÃ CHỌN</span><h2 id="cart-title">{order ? "Đã nhận đơn hàng" : checkingOut ? "Đặt hàng" : <>Giỏ hàng <small>({count})</small></>}</h2></div><button className="icon-button" aria-label="Đóng giỏ hàng" disabled={placingOrder} onClick={() => dialog.current?.close()}><Icon name="close"/></button></div>{loading || error ? <div className="empty" role="status">{loading ? "Đang tải dữ liệu giỏ hàng…" : "Chưa thể tải sản phẩm trong giỏ. Vui lòng đóng giỏ và thử lại."}</div> : order ? <div className="empty order-success" role="status"><Icon name="check" size={48}/><h2>Cảm ơn bạn đã đặt hàng!</h2><p>Mộc đã nhận đơn hàng của bạn.<br/>Thanh toán khi nhận hàng (COD).</p><div className="order-receipt"><span>Mã đơn hàng</span><strong>{order.id}</strong><span>Tổng thanh toán</span><b>{money(order.total_amount)}</b></div><p>Hãy lưu mã đơn để tiện liên hệ với mộc.</p><button className="primary-button" onClick={() => dialog.current?.close()}>Tiếp tục khám phá <Icon name="arrow"/></button></div> : checkingOut ? <CheckoutForm products={products} cart={cart} onBack={() => setCheckingOut(false)} onBusy={setPlacingOrder} onRefresh={refreshCheckout} onSuccess={receipt => { setOrder(receipt); setCart({}); setCheckingOut(false); }}/> : count ? <><div className="shipping-progress"><p>{total >= 499000 ? "Giỏ hàng của bạn được miễn phí vận chuyển!" : `Thêm ${money(499000 - total)} để được miễn phí vận chuyển`}</p><div><span style={{ width: `${Math.min(total / 499000 * 100, 100)}%` }}/></div></div><div className="cart-items">{products.filter(p => cart[p.id]).map(p => <div className="cart-item" key={p.id}><div className="cart-product-image"><ProductImage key={p.image_url} product={p}/></div><div><h3>{p.name}</h3><p>{money(p.price)}</p><div className="quantity"><button aria-label={`Giảm ${p.name}`} onClick={() => change(p.id, -1)}><Icon name="minus" size={14}/></button><span>{cart[p.id]}</span><button aria-label={`Tăng ${p.name}`} disabled={cart[p.id] >= 99} onClick={() => change(p.id, 1)}><Icon name="plus" size={14}/></button></div></div><button className="remove" aria-label={`Xóa ${p.name}`} onClick={() => setCart(previous => { const next = { ...previous }; delete next[p.id]; return next; })}><Icon name="close" size={16}/></button></div>)}</div><div className="cart-summary"><div><span>Tạm tính</span><strong>{money(total)}</strong></div><div><span>Phí vận chuyển</span><span>{total >= 499000 ? "Miễn phí" : money(30000)}</span></div><div className="total"><strong>Tổng cộng</strong><strong>{money(total + shippingFee(total))}</strong></div><button className="primary-button" onClick={() => setCheckingOut(true)}>Tiến hành đặt hàng <Icon name="arrow"/></button><p>Thanh toán khi nhận hàng · Không cần đăng nhập</p></div></> : <div className="empty"><Icon name="bag" size={45}/><h2>Giỏ hàng đang chờ bạn</h2><p>Thêm một điều nhỏ cho ngày thật đẹp.</p><button className="primary-button" onClick={() => dialog.current?.close()}>Khám phá sản phẩm <Icon name="arrow"/></button></div>}</div></dialog>
    <dialog ref={detailDialog} className="cart-dialog" aria-labelledby="detail-title" onClose={() => detailRequest.current?.abort()} onClick={e => { if (e.target === e.currentTarget) detailDialog.current?.close(); }}>
      <div className="cart-panel"><div className="cart-heading"><h2 id="detail-title">Chi tiết sản phẩm</h2><button className="icon-button" aria-label="Đóng chi tiết" onClick={() => detailDialog.current?.close()}><Icon name="close"/></button></div>
        {detailLoading ? <p role="status">Đang tải chi tiết…</p> : detailError ? <div role="alert"><p>{detailError}</p><button onClick={() => openDetail(detailId.current)}>Thử lại</button></div> : detail ? <><div className="product-image"><ProductImage key={detail.image_url} product={detail}/></div><h3>{detail.name}</h3><p>{money(detail.price)}</p><button className="primary-button" onClick={() => { change(detail.id, 1); setToast(`Đã thêm ${detail.name} vào giỏ`); detailDialog.current?.close(); }}>Thêm vào giỏ <Icon name="plus"/></button></> : <p role="status">Sản phẩm không còn tồn tại hoặc không được phép xem.</p>}
      </div>
    </dialog>
  </>;
}
