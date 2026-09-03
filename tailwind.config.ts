import type { Config } from "tailwindcss";
export default { content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"], theme:{extend:{colors:{ink:"#17212B",mist:"#F5F7F8",lime:"#D7F36A",coral:"#FF8C69",sky:"#62B7E7"},boxShadow:{soft:"0 18px 55px rgba(21, 33, 43, .10)"},borderRadius:{'4xl':'2rem'}}}, plugins:[] } satisfies Config;
