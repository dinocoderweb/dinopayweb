import { Suspense } from "react"; import { SearchResults } from "@/components/features/search-results";
export default function Search(){return <Suspense fallback={<section className="mx-auto max-w-7xl px-5 py-20"><p className="animate-pulse font-serif text-3xl">Finding good things…</p></section>}><SearchResults/></Suspense>}
