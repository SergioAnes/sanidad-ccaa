import { App } from "@/components/App";
import { construirDatos } from "@/lib/app/datos-app";

export default function Home() {
  // Se calcula al compilar: la página exportada ya lleva los datos dentro.
  return <App datos={construirDatos()} />;
}
