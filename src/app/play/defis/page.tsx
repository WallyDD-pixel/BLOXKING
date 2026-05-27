import { redirect } from "next/navigation";

/** Défis ouverts retirés — redirection vers le matchmaking. */
export default function DefisPage() {
  redirect("/play/recherche");
}
