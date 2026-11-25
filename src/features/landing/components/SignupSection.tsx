import { SIGNUP_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

/* Inscripción: reserva del lugar en Luma. */
export function SignupSection() {
  return (
    <section id="inscripcion" className={styles.section} aria-labelledby="signup-title">
      <div className={`${styles.container} ${styles.signup}`} data-reveal>
        <div>
          <h2 id="signup-title" className={styles.signupTitle}>
            Reserva tu lugar en el auditorio
          </h2>
          <p className={styles.signupText}>El aforo es de 80 a 100 personas. La inscripción se hace en Luma.</p>
        </div>
        <CtaLink href={SIGNUP_HREF} variant="ghost">
          Inscribirme en Luma
        </CtaLink>
      </div>
    </section>
  );
}
