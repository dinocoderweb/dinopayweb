import type { Category, Listing } from "@/types";
export const categories: Category[] = [
 {id:"home",name:"Home & living",description:"Make everyday spaces work beautifully.",icon:"⌂",color:"bg-[#DDF4EB]"},
 {id:"digital",name:"Digital studio",description:"Tools and talent for your next launch.",icon:"✦",color:"bg-[#E5E9FF]"},
 {id:"wellness",name:"Wellness",description:"Small rituals for feeling your best.",icon:"◌",color:"bg-[#FFE9D9]"},
 {id:"business",name:"Business growth",description:"Thoughtful support for ambitious teams.",icon:"↗",color:"bg-[#EBF4CC]"}
];
export const listings: Listing[] = [
 {id:"desk-kit",name:"Focus Desk Kit",category:"Home & living",description:"A calmer desk, from first light to last task.",price:"$64",rating:4.9,image:"linear-gradient(145deg,#c8d6d0,#eef0e4)",kind:"Product",badge:"Popular"},
 {id:"brand-sprint",name:"Brand clarity sprint",category:"Digital studio",description:"One focused week to find the story worth telling.",price:"From $450",rating:5,image:"linear-gradient(145deg,#e9bb99,#f5e8df)",kind:"Service",badge:"Featured"},
 {id:"plant-plan",name:"Plant care plan",category:"Home & living",description:"Personal guidance for a thriving indoor jungle.",price:"$28/mo",rating:4.8,image:"linear-gradient(145deg,#89b98b,#d9e9bd)",kind:"Service"},
 {id:"studio-notes",name:"Studio Notes No. 01",category:"Digital studio",description:"A tactile notebook for generous ideas.",price:"$18",rating:4.9,image:"linear-gradient(145deg,#9298ac,#e7e2d7)",kind:"Product"}
];
export const getListings = (query = "") => listings.filter((item) => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
