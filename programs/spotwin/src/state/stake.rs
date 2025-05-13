use anchor_lang::prelude::*;

#[account]
pub struct StakeAccount  {
    pub owner: Pubkey,
    pub amount: u64,
    pub start_slot: u64,
}

impl StakeAccount {
    pub const LEN: usize = 
        8   + // discriminator
        32  + // owner
        8   + // amount
        8 + 1;    // start_slot
}