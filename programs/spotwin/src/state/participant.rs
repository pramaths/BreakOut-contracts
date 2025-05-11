use anchor_lang::prelude::*;


#[account]
pub struct Participant {
 pub player: Pubkey,
 pub attempt_mask: u16,
 pub answer_bits:  u16,
}

impl Participant {
    pub const LEN: usize =
        8  +            // Anchor account discriminator
        32 + 2 + 2 +     // player, attempt_mask, answer_bits
        1;             // vault_bump
    
}