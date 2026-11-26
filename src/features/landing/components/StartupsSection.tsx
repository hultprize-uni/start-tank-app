import { STARTUPS } from "../content";
import styles from "./landing.module.css";

/*
 * "Nos acompañan estas startups": carrusel infinito de logos. La lista se repite para que el carril
 * nunca se quede corto y el bucle no tenga salto; las copias quedan ocultas para lectores de pantalla.
 */
/* 6 copias: cada mitad del carril (3 copias, unos 3300 px) es más ancha que cualquier pantalla de proyector. */
const COPIES = [0, 1, 2, 3, 4, 5];

export function StartupsSection() {
  return (
    <section id="startups" className={styles.section} aria-labelledby="startups-title">
      <div className={styles.container}>
        <h2 id="startups-title" className={styles.sectionTitle} data-reveal="sweep">
          Nos acompañan estas startups
        </h2>
      </div>
      <div className={styles.marquee}>
        <ul className={styles.marqueeTrack}>
          {COPIES.map((copy) =>
            STARTUPS.map((startup) => (
              <li key={`${copy}-${startup.name}`} className={styles.marqueeItem} aria-hidden={copy > 0 ? true : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element -- logos pequeños y estáticos */}
                <img src={startup.logo} alt={copy === 0 ? startup.name : ""} height={72} />
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}
