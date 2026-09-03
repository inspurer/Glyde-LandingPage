"use client";

import { useState } from "react";

import styles from "./deposit.module.css";

export type DepositFaqItem = {
  question: string;
  answer: string;
};

export function DepositFaq({
  items,
  initialOpen,
  idPrefix,
}: {
  items: readonly DepositFaqItem[];
  initialOpen: number | null;
  idPrefix: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpen);

  return (
    <div className={styles.faqList}>
      {items.map((item, index) => {
        const open = index === openIndex;
        const answerId = `${idPrefix}-answer-${index}`;

        return (
          <section
            className={`${styles.faqItem} ${open ? styles.faqItemOpen : ""}`}
            key={item.question}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                aria-controls={answerId}
              >
                <span>{item.question}</span>
                <span className={styles.faqChevron} aria-hidden="true" />
              </button>
            </h3>
            <div className={styles.faqAnswer} id={answerId} aria-hidden={!open}>
              <p>{item.answer}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
