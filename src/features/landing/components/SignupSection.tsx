import { EVENT_DETAILS, SIGNUP_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

/* Cierre de la página: inscripción, cupos y datos prácticos del evento. */
export function SignupSection() {
  return (
    <section id="inscripcion" className={styles.signup} aria-labelledby="signup-title">
      <div className={`${styles.container} ${styles.signupGrid}`}>
        <div>
          <h2 id="signup-title" className={styles.signupTitle}>
            Trae tu criterio.
            <br />
            El capital lo ponemos nosotros.
          </h2>
          <p className={styles.sectionLead}>
            Cupos limitados al aforo del Auditorio CTIC. La inscripción cierra el 24 de noviembre.
          </p>
          <CtaLink href={SIGNUP_HREF} className={styles.pulseCta}>
            Inscríbete en Luma
          </CtaLink>
        </div>
        <dl className={styles.details}>
          {EVENT_DETAILS.map((detail) => (
            <div key={detail.label} className={styles.detail}>
              <dt className={styles.detailLabel}>{detail.label}</dt>
              <dd className={styles.detailValue}>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
