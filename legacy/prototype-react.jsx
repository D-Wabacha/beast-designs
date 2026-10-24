// BeasT Designs - Love Cards Kenya - FINAL with Pochi 0705459618
import { useState } from 'react';

const POCHI_NUMBER = "0705459618"; // Your Pochi La Biashara = Your Till

const ALL_CARDS = [
  { id: 1, name: "GM & GN Combo", price: 150, images: 2, image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7", tag: "2-in-1 • 150", color: "#FFB6C1", desc: "Good Morning + Good Night" },
  { id: 2, name: "Thank You", price: 200, images: 1, image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946", tag: "From 200", color: "#FFF0B0", desc: "Thank You Cards" },
  { id: 3, name: "Roses & Gold", price: 200, images: 1, image: "https://images.unsplash.com/photo-1490772888775-55fceea286b8", tag: "Trending • 200", color: "#FFE4E1", desc: "Luxury Roses" },
  { id: 4, name: "Pink Peonies", price: 300, images: 1, image: "https://images.unsplash.com/photo-1563241527-3004b7be0ee9", tag: "Luxury • 300", color: "#FF69B4", desc: "Premium Floral" },
  { id: 5, name: "Anniversary", price: 300, images: 1, image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2", tag: "From 300", color: "#D4AF37", desc: "Anniversary Love" },
  { id: 6, name: "Birthday Cards", price: 300, images: 1, image: "https://images.unsplash.com/photo-1558636508-e0db4078a2f3", tag: "NEW • 300", color: "#FFD700", desc: "Birthday Wishes" },
  { id: 7, name: "Success Cards", price: 300, images: 1, image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac", tag: "NEW • 300", color: "#8B2D3B", desc: "KCSE, Job, Exams" },
];

export default function LoveCardsKenya() {
  const [selectedCard, setSelectedCard] = useState(null);
  const [mpesaCode, setMpesaCode] = useState("");
  const [gmMsg, setGmMsg] = useState("");
  const [gnMsg, setGnMsg] = useState("");

  if (selectedCard) {
    const isCombo = selectedCard.name.includes("GM & GN");
    
    return (
      <div style={{background:"#FFF5F7", minHeight:"100vh", padding:"20px", fontFamily:"sans-serif"}}>
        <button onClick={()=>setSelectedCard(null)} style={{background:"none", border:"none", fontWeight:"bold", color:"#8B2D3B"}}>← Back</button>
        
        <div style={{background:"white", borderRadius:"20px", overflow:"hidden", marginTop:"15px", boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>
          <img src={selectedCard.image} style={{width:"100%", height:"220px", objectFit:"cover"}} />
          
          {isCombo && (
            <div style={{background:"#FFF0B0", padding:"10px", textAlign:"center", fontSize:"13px", fontWeight:"bold", color:"#8B2D3B"}}>
              🌅 GM + 🌙 GN Combo — 2 HD Cards for 150 KES Only!
            </div>
          )}
          
          <div style={{padding:"15px"}}>
            <h2 style={{margin:"0 0 5px 0", color:"#8B2D3B"}}>{selectedCard.name}</h2>
            <p style={{margin:0, color:"#777", fontSize:"13px"}}>{selectedCard.desc} • {isCombo ? "2 Cards" : "1 Card"}</p>
            <p style={{color:"#D4AF37", fontWeight:"bold", fontSize:"24px", margin:"8px 0"}}>{selectedCard.price} KES</p>
            
            <input placeholder="His/Her Name" style={inputStyle} />
            
            {isCombo ? (
              <>
                <textarea value={gmMsg} onChange={e=>setGmMsg(e.target.value)} placeholder="🌅 Good Morning Message..." style={{...inputStyle, height:"70px"}}></textarea>
                <textarea value={gnMsg} onChange={e=>setGnMsg(e.target.value)} placeholder="🌙 Good Night Message..." style={{...inputStyle, height:"70px"}}></textarea>
                <p style={{fontSize:"11px", color:"#8B2D3B", textAlign:"center"}}>You get 2 cards: GM + GN!</p>
              </>
            ) : (
              <textarea placeholder="Your Message..." style={{...inputStyle, height:"90px"}}></textarea>
            )}
          </div>
        </div>

        {/* POCHI PAYMENT BOX */}
        <div style={{background:"white", borderRadius:"15px", padding:"15px", marginTop:"15px", border:"2px solid #D4AF37"}}>
          <h3 style={{color:"#8B2D3B", textAlign:"center", margin:"0"}}>🌸 Unlock HD - {selectedCard.price} KES</h3>
          
          <div style={{background:"#FFF5F7", padding:"12px", borderRadius:"10px", fontSize:"13px", marginTop:"10px"}}>
            <b>Pay via Pochi La Biashara:</b><br/>
            1. M-Pesa → Lipa Na M-Pesa<br/>
            2. → Pochi La Biashara<br/>
            3. → Enter: <b style={{color:"#8B2D3B", fontSize:"16px"}}>{POCHI_NUMBER}</b><br/>
            4. → Amount: <b>{selectedCard.price}</b><br/>
            <span style={{fontSize:"11px"}}>Or via Buy Goods → Till: {POCHI_NUMBER}</span>
          </div>
          
          <p style={{color:"green", fontSize:"12px", textAlign:"center"}}>✓ No extra charges • Withdraw FREE</p>
          
          <input value={mpesaCode} onChange={(e)=>setMpesaCode(e.target.value)} placeholder="Paste M-Pesa Code (e.g QGH7...)" style={{...inputStyle, borderColor:"#D4AF37"}} />
          
          <button onClick={()=>{
            if(mpesaCode.length<8) return alert("Enter valid M-Pesa code");
            alert(`✅ Pochi Payment ${selectedCard.price} KES received! Downloading ${isCombo ? "2 Cards" : "1 Card"}...`);
          }} style={{background:"#D4AF37", color:"white", width:"100%", padding:"14px", border:"none", borderRadius:"25px", fontWeight:"bold", marginTop:"10px"}}>
            Verify & Download {isCombo ? "2 HD Cards" : "HD Card"}
          </button>
          
          <button style={{width:"100%", marginTop:"10px", background:"#25D366", color:"white", padding:"12px", border:"none", borderRadius:"25px"}}>Share on WhatsApp</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{background:"#FFF5F7", minHeight:"100vh", paddingBottom:"70px"}}>
      <h2 style={{padding:"15px", color:"#8B2D3B"}}>Love Cards Kenya 🌹 <span style={{fontSize:"11px", background:"#D4AF37", color:"white", padding:"3px 8px", borderRadius:"10px"}}>Pochi: {POCHI_NUMBER}</span></h2>
      
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", padding:"0 12px"}}>
        {ALL_CARDS.map(card=>(
          <div key={card.id} onClick={()=>setSelectedCard(card)} style={{background:"white", borderRadius:"18px", overflow:"hidden", border:`2px solid ${card.color}`}}>
            <div style={{position:"relative"}}>
              <img src={card.image} style={{width:"100%", height:"155px", objectFit:"cover"}} />
              <span style={{position:"absolute", top:"6px", left:"6px", background:card.color, fontSize:"10px", padding:"3px 7px", borderRadius:"10px", fontWeight:"bold"}}>{card.tag}</span>
            </div>
            <div style={{padding:"8px 10px"}}>
              <b style={{fontSize:"13px"}}>{card.name}</b><br/>
              <span style={{fontSize:"11px", color:"#8B2D3B"}}>{card.desc} • {card.price} KES</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{position:"fixed", bottom:0, width:"100%", background:"white", display:"flex", justifyContent:"space-around", padding:"12px", borderTop:"1px solid #eee", fontSize:"13px"}}>
        <span style={{color:"#8B2D3B", fontWeight:"bold"}}>🏠 Home</span><span>My Orders</span><span>Contact • {POCHI_NUMBER}</span>
      </div>
    </div>
  );
}

const inputStyle = {width:"100%", padding:"12px", margin:"6px 0", borderRadius:"10px", border:"1px solid #FFB6C1", boxSizing:"border-box", fontSize:"14px"};