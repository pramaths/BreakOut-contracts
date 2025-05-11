use anchor_lang::prelude::*;

/// Contest account
#[account]
pub struct Contest {
    pub creator: Pubkey,
    pub contest_id: u64,
    pub pool_mint: Pubkey, // USDC or SPOT
    pub entry_fee: u64,
    pub lock_slot: u64,

    pub status: ContestStatus,
    pub total_entries: u32,
    pub answer_key: u16,
    pub payout_root:  [u8; 32], 
    pub winner_count: u32,
    pub paid_so_far:  u64,

    pub contest_bump: u8,
    pub vault_bump:   u8,
    pub vault_authority_bump: u8, // Added field for authority bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ContestStatus {
    Open,
    Locked,
    AnswerKeyPosted,
    Settled,
    Cancelled,
}

impl Contest {
    pub const LEN: usize =
        8  +            // Anchor account discriminator
        32 + 8 + 32 + 8 + 8 +          // creator, contest_id, pool_mint, entry_fee, lock_slot
        1  + 4 + 2  + 32 + 4 + 8 +     // status, total_entries, answer_key, root, winner_count, paid
        1 + 1 + 1;                     // contest_bump, vault_bump, vault_authority_bump
}
